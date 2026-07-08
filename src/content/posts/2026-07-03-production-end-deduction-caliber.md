---
title: "结束流程中的资源扣减口径设计"
published: 2026-07-03
description: "围绕结束确认、实际数量、已用数量、剩余数量和库存流水，整理资源扣减流程里的口径一致性设计。"
image: "/images/covers/005u7pl0gy1idww4l2kfsj31kw11y7ay.jpg"
tags: [技术实践]
category: 技术实践
draft: false
---
很多业务流程在开始阶段都很清晰：分配资源、扫码确认、进入执行。但到了结束阶段，问题会突然变复杂。

结束时系统要回答的不只是“这张任务完成了吗”，还要回答：实际完成数量是多少？哪些资源被纳入消耗？哪些资源仍有剩余？补充资源是否已经使用？库存流水按什么数量记录？前端展示的“已用”和后端扣减的数量是否一致？

如果这些口径没有统一，最常见的结果就是：界面看起来扣了 A，库存实际扣了 B，流水记录又是 C。

## 抽象场景

假设一个任务在执行过程中分配了多批资源。结束时，用户需要输入实际完成数量，并确认资源消耗情况。

资源可能有几种状态：

- 初始分配资源，可能全部或部分消耗。
- 补充资源，可能使用，也可能没有使用。
- 当前剩余数量，来自资源标签或库存记录。
- 用户在结束确认时提交的扣减数量。

这时需要明确一个问题：结束流程到底按哪个字段扣减？

```mermaid
flowchart LR
  A["打开结束确认"] --> B["加载已分配资源"]
  B --> C["输入实际完成数量"]
  C --> D["刷新异常与扣减建议"]
  D --> E["用户确认扣减明细"]
  E --> F["后端事务扣减库存"]
  F --> G["记录库存流水"]
```

## 问题拆解

结束扣减流程里通常有三套数量。

第一套是分配数量。它表示系统曾经把多少资源分配给任务，但不代表最终一定被消耗。

第二套是当前剩余数量。它表示资源标签或库存对象当前还剩多少，但对于已经使用过的补充资源，仅看剩余数量可能不能还原“本次应纳入计算多少”。

第三套是结束纳入计算数量。它更接近结束确认所需的业务口径：哪些资源应视为已使用，应该在结束流程里参与扣减、展示和异常检查。

如果页面只展示“分配”和“剩余”，用户很难判断系统实际要扣多少。增加一个明确的 `usedQty` 或类似字段，可以把扣减口径直接暴露出来。

## 前端：弹窗打开前先加载明细

结束确认通常会弹出二次确认或输入实际数量。如果用户还没看到资源明细，就打开弹窗让他确认，风险很高。

更稳的方式是：打开结束弹窗前，先确保资源明细已经加载成功。

```js
async function openFinishDialog(task) {
  const loaded = await ensureUsedResourcesLoaded(task.id)
  if (!loaded) return

  state.actualQty = task.plannedQty || ''
  refreshExceptions()
  dialog.open()
}
```

这段逻辑有两个好处。

第一，异常检查有数据基础。比如资源未加载、扣减数量异常、剩余数量不一致，都可以在用户确认前提示。

第二，避免弹窗打开后才加载失败。现场操作里，弹窗已经打开又提示“明细加载失败”，用户会很难判断是否还能继续。

## 前端：避免重复加载和旧请求覆盖

移动端列表中切换任务很快，如果每次点开都发请求，旧请求可能晚于新请求返回，覆盖当前任务的明细。

可以用“当前加载任务 ID + promise 复用”的模式：

```js
async function ensureUsedResourcesLoaded(taskId) {
  if (state.loadedTaskId === taskId && state.items.length > 0) {
    return true
  }
  if (state.loadingPromise && state.loadingTaskId === taskId) {
    return state.loadingPromise
  }

  state.loadingTaskId = taskId
  state.loadingPromise = api.getUsedResources(taskId)
    .then(list => {
      if (state.selectedTaskId === taskId) {
        state.items = normalize(list)
        state.loadedTaskId = taskId
      }
      return true
    })
    .catch(() => false)
    .finally(() => {
      state.loadingPromise = null
    })

  return state.loadingPromise
}
```

核心原则是：请求结果只能写回它所属的任务，不能覆盖当前用户已经切换到的任务。

## 后端：扣减数量要有单一口径

后端扣减时，最怕同一流程里混用多个数量字段。

例如库存扣减用 `deductQty`，流水记录用另一个临时变量，分配记录又写第三个字段。只要其中一个字段计算口径不同，后续对账就会很痛苦。

更好的做法是先解析出“本次库存扣减数量”，再复用这个结果更新库存、写流水和回填分配记录：

```java
BigDecimal inventoryDeductQty = resolveDeductQty(requestItem, allocation, label);
if (inventoryDeductQty.compareTo(BigDecimal.ZERO) > 0) {
    label.decrease(inventoryDeductQty);
    inventoryFlow.record(label.id(), inventoryDeductQty.negate());
    allocation.markDeducted(inventoryDeductQty);
}
```

这里的重点不是方法名，而是变量语义：`inventoryDeductQty` 一旦确定，后续链路都用它，避免“扣减”和“记录”口径分叉。

## 已用数量：比剩余数量更适合展示消耗口径

结束页面展示资源明细时，只显示“分配数量”和“剩余数量”是不够的。

用户真正关心的是：这条资源在结束时被系统纳入了多少消耗计算。因此可以增加一个明确展示项：

- 分配数量：系统曾分配多少。
- 已用数量：结束流程纳入计算多少。
- 剩余数量：当前资源还剩多少。

这三个字段放在一起，用户才能理解扣减依据。尤其是补充资源、部分使用、剩余退回等场景，`usedQty` 能减少大量口头解释。

## 常见坑

第一，弹窗先打开，明细后加载。这样异常检查时机太晚，用户已经进入确认路径。

第二，实际数量改变后没有刷新异常。实际完成数量会影响应消耗数量，输入变化后需要重新计算提示。

第三，请求返回不校验当前任务。用户切换任务后，旧请求写回页面，会造成明细错位。

第四，流水数量和库存扣减数量不是同一个变量。库存和流水一旦口径不一致，后面排查会非常难。

第五，只看当前剩余数量判断已用。剩余数量是结果，不一定能表达本次结束流程应该纳入计算的量。

## 可复用经验

- 结束确认前先加载资源明细。
- 实际数量输入要触发异常刷新。
- 异步请求写回前校验当前任务。
- 扣减数量解析后要贯穿库存、流水和分配记录。
- 展示层同时给出分配、已用、剩余三种口径。
- 后端事务内完成库存变更和流水记录。

## 总结

结束流程不是简单的“点完成”，而是一次资源消耗口径的最终确认。

把加载时机、实际数量、已用数量、库存扣减和流水记录统一起来，系统才能做到前端看得懂、后端扣得准、后续查得清。对于任何涉及库存、资产、额度或批次消耗的系统，这套思路都值得复用。
