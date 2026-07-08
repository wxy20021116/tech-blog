---
title: "现场备料中的条码替换闭环设计"
published: 2026-07-02
description: "从一次备料条码替换能力建设中，总结候选标签筛选、移动端弹窗交互、后端原子替换和重复占用防护的设计方法。"
image: "/images/covers/006a0Rdhgy1idx26dtxbqj31o42801ij.jpg"
tags: [移动端, 条码替换, 状态一致性, 前后端协同]
category: 工程实践
draft: false
---
## 背景：一个抽象场景

现场操作系统里，资源通常会在计划阶段被预分配到任务明细上。但真实执行时，预分配对象可能不可用：数量不合适、现场位置变化、条码无法读取，或者操作员发现同物料下还有更合适的对象。

这时如果只能重新计算整张单据，成本太高；如果允许用户随便改条码，又会破坏任务与资源之间的对应关系。更合理的方式，是提供一个受控的“条码替换”能力：只允许替换未执行的明细，只能选择同物料、同区域、可用且未被当前单据重复使用的标签，并由后端一次性更新完整快照字段。

![mobile scan flow](https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80)

这次实践可以抽象成一个问题：**移动端现场替换资源时，如何既给用户灵活性，又不破坏后端状态一致性？**

## 问题拆解

### 1. 替换不是简单改一个标签 ID

待执行明细上通常保存的不只是 `labelId`，还包括唯一编码、数量、品名规格、单位、所在区位、仓库、库位等快照字段。替换标签时，如果只改 ID，页面和后续扫码可能继续使用旧快照，造成“ID 是新的，展示和校验还是旧的”。

所以替换动作必须把资源快照一起更新。

### 2. 候选范围必须由后端收敛

移动端可以提供筛选和分页，但不能自己判断哪些标签可替换。候选集合至少要满足：

- 与目标明细是同一资源。
- 标签已激活且数量大于 0。
- 标签不属于退货或不可用状态。
- 位于当前任务允许的操作区域。
- 所在仓库类型符合当前筛选模式。
- 未被当前单据其它明细使用。

这些规则涉及后端事实数据，应该由后端统一生成候选列表。

### 3. 弹窗交互要暂停扫描上下文

移动端现场页面通常有扫码监听。打开替换弹窗时，如果仍然持续处理扫码输入，可能出现弹窗选择和后台扫码同时更新状态。弹窗打开前要记录扫描状态，关闭后再恢复，避免两条操作流互相打架。

## 方案设计

### 后端：候选列表按事实过滤

候选接口先加载目标明细，并确认它还没有执行。然后基于目标明细的资源、区域和当前模式，生成候选仓库集合，再查询可用标签。

```java
Page<Candidate> listReplacementCandidates(Request req) {
    TaskLabel target = getUnfinishedLabel(req.targetId());
    List<Long> warehouseIds = listCandidateWarehouses(target.locationId(), req.mode());

    Set<Long> usedByCurrentTask = labelMapper.selectByTaskId(target.taskId()).stream()
        .filter(item -> !item.id().equals(target.id()))
        .map(TaskLabel::labelId)
        .collect(toSet());

    return labelMapper.pageActivatedLabels(
        target.resourceId(),
        target.locationId(),
        warehouseIds,
        usedByCurrentTask
    );
}
```

这里有个重要细节：候选列表中可以包含“当前正在使用的标签”，用于展示当前选择，但必须排除当前单据其它明细已经占用的标签，防止一盘料被同一张单据重复绑定。

### 移动端：候选弹窗只表达操作意图

移动端弹窗可以按“智能货架 / 非智能货架”切换候选模式，支持分页加载和当前标签高亮。它不需要复制全部业务规则，只要把目标明细和候选标签提交给后端。

```js
async function openReplaceDialog(row) {
  scanStateBeforeDialog.value = scanning.value;
  stopScan();

  selectedRow.value = row;
  candidates.value = [];
  pageNo.value = 1;
  await loadCandidates();
}

async function confirmReplace(candidate) {
  await api.replaceLabel({
    targetId: selectedRow.value.id,
    labelId: candidate.labelId
  });
  closeDialog();
  await reloadDetail();
}
```

弹窗关闭后恢复扫描状态，让现场操作回到原来的节奏。

![warehouse workflow](https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80)

### 后端：替换动作要原子更新

替换提交时，后端不能只相信候选接口曾经返回过这个标签。因为候选列表加载后，现场数据可能已经变化。提交时要重新校验目标明细和新标签。

```java
@Transactional
void replaceLabel(ReplaceRequest req) {
    TaskLabel target = getUnfinishedLabel(req.targetId());
    Label label = labelMapper.selectById(req.labelId());

    validateSameResource(target, label);
    validateAvailable(label);
    validateSameLocation(target, label);
    validateWarehouseType(label);
    validateNotDuplicatedInTask(target.taskId(), target.id(), label.id());

    taskLabelMapper.updateById(target.id(), update -> update
        .setLabelId(label.id())
        .setUniqueCode(label.uniqueCode())
        .setCurrentQty(label.currentQty())
        .setLocationId(label.locationId())
        .setWarehouseId(label.warehouseId())
        .setSlotId(label.slotId()));
}
```

这个接口的关键不是“能改”，而是每次改之前都重新确认目标仍然可改、候选仍然可用。

```mermaid
flowchart LR
  Open["打开替换弹窗"] --> Pause["暂停扫码监听"]
  Pause --> Candidates["后端生成候选标签"]
  Candidates --> Select["用户选择候选"]
  Select --> Validate["提交时重新校验"]
  Validate --> Update["原子更新标签与快照字段"]
  Update --> Reload["刷新详情并恢复扫码"]
```

## 常见坑

### 1. 候选列表过滤了，提交接口不校验

候选列表只是某个时间点的快照。真正写入前必须再次校验，否则并发操作会绕过候选规则。

### 2. 只更新标签 ID

后续展示、扫码确认、亮灯定位往往依赖快照字段。替换时必须同步数量、唯一码、位置等字段。

### 3. 弹窗打开时仍处理扫码

替换弹窗和扫码流是两种不同操作上下文。弹窗期间继续处理扫码，容易造成用户还没确认替换，页面已经被扫码状态更新。

## 可复用经验

现场资源替换可以按这几个原则设计：

- 候选范围由后端事实过滤，前端只做展示和分页。
- 替换提交前重新校验目标和候选。
- 更新资源 ID 时同步更新快照字段。
- 排除当前单据其它明细已占用的标签。
- 移动端弹窗打开时暂停扫描，关闭后恢复。
- 替换完成后刷新详情，不靠本地拼接复杂状态。

## 总结

条码替换能力的价值，是给现场操作留出纠错空间；它的风险，是让资源关系从计划态滑向不可控的手工修改。

可靠的实现方式，是把灵活性放在候选选择上，把权威规则放在后端校验上，把移动端交互控制在一个明确的弹窗上下文里。这样用户可以高效替换，系统仍然保持资源状态的可解释性。
