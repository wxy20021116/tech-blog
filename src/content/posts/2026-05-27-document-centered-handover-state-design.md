---
title: "多单据聚合场景下的交接流程与状态阻塞设计"
published: 2026-05-27
description: "从一次移动端交接流程改造中，抽象多业务单据聚合、进度统计、扫描校验和状态阻塞的设计方法。"
image: "https://p6.itc.cn/q_70/images03/20210503/2747d4f3c2c3445b9bb97ef7a5255fcf.jpeg"
tags: [后端, PDA, 状态一致性, 接口设计]
category: 技术实践
draft: false
---
## 背景：一个抽象的交接场景

在现场作业系统里，移动端经常要处理一种看似简单、实际很容易出错的流程：某一批资源已经从主流程中退回，需要由操作人员完成交接、扫描、确认和状态回写。

如果系统最初只按“单个业务单据”设计，流程会比较直接：

1. 打开某个业务单据；
2. 展示该单据下待交接的资源；
3. 扫描资源唯一标识；
4. 校验通过后更新交接状态。

但当业务演进后，一个更高层级的“准备单”可能同时关联多个业务单据。同一个交接动作不再只属于某一个单据，而是要按准备单进行汇总、展示和阻塞判断。此时如果继续沿用旧模型，移动端和后端都会出现一些隐蔽问题：

- 列表页看不到整体进度，只能看到零散子单据；
- 扫描页不知道当前资源应该归属哪一组交接任务；
- 后端匹配资源时只按单个单据过滤，导致聚合场景下误判；
- 某些子单据未完成时，移动端仍然允许继续操作；
- 已分配但未进入下一环节的资源，容易在状态流转中丢失来源信息。

![workflow planning](https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&fm=jpg&q=70&w=1200)

这类问题本质上不是“页面多展示一个字段”，而是交接流程的主维度发生了变化：从“子单据视角”升级为“聚合单据视角”。

## 问题拆解

我把这次改造抽象成四个问题。

### 1. 查询维度变化

旧模型中，接口参数通常是：

```text
businessOrderId
```

而新模型需要支持：

```text
preparationOrderId
```

它们不是简单替换关系。前者定位一个具体子单据，后者定位一组相关子单据。后端查询逻辑要从“查一张明细表”变成“查聚合组，再展开多个子单据，再汇总资源明细”。

### 2. 展示维度变化

移动端列表不能只显示资源明细，还要告诉用户：

- 当前准备单下有多少资源待交接；
- 已扫描多少；
- 是否存在阻塞项；
- 哪些子单据还未满足交接条件。

这意味着接口响应不应只是一个扁平数组，而应该包含进度、分组和阻塞原因。

### 3. 扫描校验变化

扫描页的核心不只是“扫到一个码”，而是回答三个问题：

```text
这个资源是否属于当前聚合单据？
这个资源是否处于允许交接的状态？
这个资源交接后，会不会影响同组其他单据的状态？
```

如果只校验资源是否存在，很容易把别的流程里的资源误扫进来。

### 4. 状态回写变化

交接完成后，系统要更新的不止资源本身，还可能包括：

- 当前资源的交接状态；
- 所属子单据的完成进度；
- 聚合单据的整体状态；
- 原来源位置或原绑定关系；
- 后续流程能否继续执行。

状态回写如果散落在多个接口里，会让系统越来越难维护。

## 方案设计

比较稳妥的做法，是把“聚合单据”提升为交接流程的一等参数。

```mermaid
flowchart LR
    A["Mobile list"] --> B["Query by preparationOrderId"]
    B --> C["Backend expands child orders"]
    C --> D["Group resources and calculate progress"]
    D --> E["Return blockers and scan scope"]
    E --> F["Mobile scan"]
    F --> G["Backend authoritative validation"]
    G --> H["Update resource and handover status"]
```

这条链路里，移动端负责清晰展示和减少误操作；后端负责权威校验和状态一致性。

## 后端：以聚合单据作为交接入口

后端接口可以保留原来的子单据查询能力，但新增聚合维度时，不要让移动端自己拼接多个子单据。移动端只应该传入一个稳定的上层 ID。

一个简化后的接口形态可以是：

```java
public HandoverOverview getHandoverOverview(Long preparationOrderId) {
    List<Long> childOrderIds = relationService.listChildOrderIds(preparationOrderId);
    List<ResourceItem> items = resourceService.listReturnableResources(childOrderIds);
    List<Blocker> blockers = handoverPolicy.checkBlockers(childOrderIds, items);

    return HandoverOverview.builder()
        .preparationOrderId(preparationOrderId)
        .totalCount(items.size())
        .finishedCount(countFinished(items))
        .blockers(blockers)
        .groups(groupByChildOrder(items))
        .build();
}
```

这里的重点不是代码本身，而是职责边界：

- `relationService` 负责把聚合单据展开；
- `resourceService` 负责查询资源明细；
- `handoverPolicy` 负责判断是否允许继续交接；
- `HandoverOverview` 负责给移动端一个可展示、可判断的完整视图。

不要把这些逻辑都堆在 Controller 里。Controller 只应该做参数接收和结果返回，真正的聚合规则放在 Service 或策略类里。

## 移动端：先展示进度，再进入扫描

移动端最容易犯的错，是把扫描页做成流程入口。实际上在聚合场景里，用户应该先看到整体进度，再进入扫描。

推荐列表页展示：

```text
准备单 A
已交接 12 / 18
状态：存在 2 个阻塞项
```

进入详情后，再展示每个子单据的资源进度：

```text
子单据 1：5 / 5
子单据 2：4 / 8
子单据 3：3 / 5
```

![mobile workflow](https://images.unsplash.com/photo-1551650975-87deedd944c3?auto=format&fit=crop&fm=jpg&q=70&w=1200)

如果后端返回阻塞信息，移动端应该明确阻止扫描入口，而不是只在扫描失败后提示。

这种设计有两个好处：

- 用户在操作前就知道为什么不能继续；
- 后端不需要通过异常承担全部交互解释责任。

## 扫描校验：不能只信任当前页面状态

移动端页面上展示了某个准备单，并不代表扫描请求就一定安全。网络延迟、重复进入页面、缓存数据、多人并发操作，都可能让移动端状态过期。

因此扫描接口仍然要以服务端为准。

一个更稳的扫描请求可以这样设计：

```java
public ScanResult scan(ScanCommand command) {
    PreparationScope scope = scopeService.loadScope(command.getPreparationOrderId());
    ResourceItem item = resourceService.getByCode(command.getResourceCode());

    if (!scope.contains(item.getBusinessOrderId())) {
        throw new BizException("资源不属于当前交接范围");
    }
    if (!handoverPolicy.canScan(item)) {
        throw new BizException("资源状态不允许交接");
    }

    handoverService.markScanned(scope, item);
    return scanResult(scope, item);
}
```

这里有一个原则：移动端可以做预校验，但后端必须做最终校验。

尤其是聚合单据场景，`preparationOrderId` 不是一个展示字段，而是扫描校验的边界条件。所有资源匹配都应该落在这个边界内。

## 状态回写：显式清理旧绑定

交接、退回、重新分配这类流程，经常伴随“旧位置”“旧绑定关系”“旧任务状态”的清理。一个容易踩坑的点是：如果使用普通实体更新，并把字段设置为 `null`，某些 ORM 默认不会把 `null` 更新到数据库。

更稳妥的写法是显式使用更新条件和 `set null`。

```java
resourceMapper.update(
    null,
    new LambdaUpdateWrapper<ResourceEntity>()
        .eq(ResourceEntity::getId, resourceId)
        .set(ResourceEntity::getSourceLocationId, null)
        .set(ResourceEntity::getSourceLocationType, null)
        .set(ResourceEntity::getCurrentHandlerId, operatorId)
        .set(ResourceEntity::getStatus, ResourceStatus.WAITING_HANDOVER)
);
```

这个细节看起来小，但它决定了“旧状态是否真的被清干净”。如果旧绑定没有清理，后续页面可能继续展示过期来源位置，甚至影响下一次分配。

## 常见坑

### 把聚合逻辑放到前端

移动端不应该自己拿多个子单据再拼成一个准备单视图。这样做会导致：

- 接口调用次数增加；
- 进度统计口径不统一；
- 状态阻塞规则散落在前端；
- 后续新增业务规则时难以维护。

聚合关系应该由后端统一返回。

### 只返回明细，不返回阻塞原因

如果接口只返回资源列表，移动端只能在用户点击或扫描后才知道不能操作。更好的方式是让后端返回阻塞项：

```json
{
  "canHandover": false,
  "blockers": [
    {
      "type": "UNFINISHED_CHILD_ORDER",
      "message": "存在未完成的子流程"
    }
  ]
}
```

移动端拿到后可以直接禁用扫描按钮，并展示明确原因。

### 交接完成后只更新资源，不更新进度

资源状态变了，不代表聚合单据状态一定自动变了。交接完成后应重新计算：

- 当前子单据是否完成；
- 当前准备单是否全部完成；
- 是否还有阻塞项；
- 是否需要触发后续流程。

状态流转要么由事务内同步完成，要么通过可靠事件异步更新，不能靠页面刷新时临时推断。

![system reliability](https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&fm=jpg&q=70&w=1200)

## 可复用经验

这类从“单据维度”升级到“聚合维度”的改造，可以复用下面的检查清单。

### 接口层

- 是否新增了聚合维度 ID？
- 是否保留了必要的兼容能力？
- 是否由后端统一展开子单据？
- 是否返回进度和阻塞信息？

### 服务层

- 是否有明确的聚合根？
- 资源匹配是否限定在聚合范围内？
- 状态更新是否在事务边界内？
- 清空字段是否显式 `set null`？

### 移动端

- 列表页是否展示整体进度？
- 扫描入口是否受阻塞状态控制？
- 扫描请求是否携带聚合维度 ID？
- 扫描失败时是否能展示具体原因？

### 数据一致性

- 是否考虑并发扫描？
- 是否考虑重复扫描？
- 是否考虑旧绑定清理？
- 是否考虑部分子单据完成、整体未完成的中间态？

## 总结

多单据聚合场景的难点，不在于多查几条数据，而在于主流程维度发生了变化。

当交接流程从“单个业务单据”升级到“准备单聚合”后，系统要同步调整查询、展示、扫描校验和状态回写。移动端负责把进度和阻塞状态展示清楚，后端负责维护聚合关系、权威校验和事务一致性。

如果只在页面上加字段，很快会遇到资源误匹配、状态误推进、旧绑定残留等问题。真正稳定的设计，是把聚合单据作为流程入口，把子单据作为内部展开结果，把资源扫描放在服务端边界内校验。

这也是很多现场作业系统可以复用的一条经验：当业务从“点状操作”变成“批量聚合操作”时，先重建流程模型，再改页面和字段。

