---
title: "批量同步中的唯一索引冲突规避策略"
published: 2026-07-01
description: "从一次库位同步修复中，总结按业务键匹配、删除前校验、临时编码避让和两阶段更新在批量重排场景中的应用。"
image: "/images/covers/9b6feba7gy1icza7pvgfmj21sg1sg1ky.jpg"
tags: [批量同步, 唯一索引, 幂等设计, 数据一致性]
category: 工程实践
draft: false
---
## 背景：一个抽象场景

后台系统经常会有“批量同步子项”的需求：用户调整一个配置，系统要把它映射成一组明细记录。比如一个父对象下有若干位置、行列、编号或子资源，用户调整配置后，后端需要新增缺失项、删除多余项、更新已有项。

这类同步看起来只是列表 diff，但如果子项表上有唯一索引，就容易出问题。尤其当新旧子项只是互换编码、重排行列或重新生成唯一编码时，直接逐条更新会在中间态触发唯一索引冲突。

![sync workflow](https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80)

这次实践可以抽象成一个问题：**批量同步时，如何避免合法的最终状态被非法的中间态拦住？**

## 问题拆解

### 1. 最终不冲突，不代表更新过程不冲突

假设有两条记录：

```text
A -> CODE-01
B -> CODE-02
```

用户调整后希望变成：

```text
A -> CODE-02
B -> CODE-01
```

最终状态是合法的，但如果先把 A 更新成 `CODE-02`，数据库会发现 B 还占着这个编码，于是唯一索引冲突。问题不在目标数据，而在更新顺序造成了临时冲突。

### 2. 同步匹配键不一定是唯一索引字段

批量同步时，必须先明确“用什么识别同一个子项”。如果用即将变化的唯一编码做匹配，一旦编码重算，系统就分不清是更新还是删除后新增。

更稳的方式是用业务稳定键匹配，比如用户可识别的库位号、序号或外部标识；唯一编码只作为结果字段更新。

### 3. 删除不是简单物理删除

如果子项可能已经被业务数据占用，删除前必须校验。否则一次配置同步可能把仍有关联数据的位置删掉，造成引用悬空。

所以同步流程要先识别待删除项，再检查是否存在占用、数量、关联标签等事实，只有空闲项才能删除。

## 方案设计

### 第一步：构建目标集合并校验内部重复

先把用户提交的配置转换成目标子项列表，并在内存中检查业务键和目标唯一编码是否重复。

```java
Map<String, Slot> desiredByNumber = new LinkedHashMap<>();
Set<String> desiredCodes = new HashSet<>();

for (Slot slot : desiredSlots) {
    String number = normalize(slot.getNumber());
    if (number.isBlank()) {
        throw badRequest("位置号不能为空");
    }
    if (desiredByNumber.put(number, slot) != null) {
        throw badRequest("位置号重复");
    }
    if (!desiredCodes.add(slot.getCode())) {
        throw badRequest("位置编码重复");
    }
}
```

这一步解决的是“目标状态自身是否合法”。如果目标集合内部已经重复，后面不应该进入数据库同步。

### 第二步：用稳定业务键匹配已有记录

从数据库加载当前子项后，用稳定业务键建立映射：

```java
Map<String, Slot> existingByNumber = existingSlots.stream()
    .filter(slot -> hasText(slot.getNumber()))
    .collect(toMap(slot -> normalize(slot.getNumber()), slot -> slot));
```

后续判断就很清楚：

- 目标有、已有无：新增。
- 目标有、已有有：更新。
- 已有有、目标无：候选删除。

唯一编码可以变化，但不会影响“同一个子项”的识别。

### 第三步：删除前校验占用

对候选删除项，不要马上删。先检查是否有数量、标签、业务引用等占用事实。

```java
void assertRemovable(List<Slot> removedSlots) {
    List<Slot> occupied = removedSlots.stream()
        .filter(slot -> slot.hasLabel() || slot.qtyGreaterThanZero() || isReferenced(slot.id()))
        .toList();
    if (!occupied.isEmpty()) {
        throw badRequest("存在已占用位置，不能删除");
    }
}
```

这一步把配置同步和业务安全分开：配置可以调整，但不能绕过资源占用规则。

### 第四步：两阶段更新避让唯一索引

真正解决唯一索引冲突的关键，是在更新目标编码前，先把所有匹配到的旧记录编码挪到临时值。

```java
for (Slot existing : matchedExistingSlots) {
    updateCode(existing.id(), "__TMP_SLOT_" + existing.id());
}

for (Slot desired : desiredSlots) {
    Slot existing = existingByNumber.get(normalize(desired.getNumber()));
    if (existing == null) {
        insert(desired);
    } else {
        updateToDesired(existing.id(), desired);
    }
}
```

临时编码必须满足两个条件：

- 全局唯一，通常可以拼接记录 ID。
- 不会与正常编码格式冲突，最好使用明确的内部前缀。

![database update](https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80)

这种做法把同步拆成两个阶段：

1. 清空旧唯一编码占位。
2. 写入目标最终编码。

最终数据没有变化，但中间态不再触发唯一索引冲突。

```mermaid
flowchart LR
  Build["构建目标子项"] --> Validate["校验目标重复"]
  Validate --> Match["按稳定业务键匹配已有记录"]
  Match --> Remove["校验并删除多余空闲项"]
  Remove --> Temp["匹配记录写入临时唯一编码"]
  Temp --> Upsert["新增或更新为目标状态"]
  Upsert --> Done["同步完成"]
```

## 常见坑

### 1. 用会变化的编码做匹配键

编码本身如果会重算，就不适合作为同步匹配键。否则一次重排会被误判成删除旧记录并新增新记录，既危险，也容易丢失原记录上的业务状态。

### 2. 直接逐条更新唯一字段

只要存在互换、重排或批量重命名，逐条更新就可能被中间态卡住。两阶段临时值是处理这类冲突的常见手段。

### 3. 删除前不检查占用

配置同步不是强制清库。候选删除项如果已有业务占用，应当拒绝同步并给出明确提示，让用户先处理关联数据。

### 4. 临时编码可能撞正常编码

临时值不要使用普通业务编码格式。用内部前缀加 ID，能降低和正常数据冲突的概率，也方便后续排查。

### 5. 没有校验目标集合重复

数据库唯一索引可以兜底，但错误会变成晦涩的数据库异常。提前在内存里校验业务键和目标编码，用户体验和排查效率都会好很多。

## 可复用经验

![reliable sync](https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80)

批量同步子项时，可以按这个清单设计：

- 先定义稳定匹配键，不要默认使用唯一编码。
- 目标集合先做重复校验，尽早失败。
- 待删除项先做占用校验，再物理删除。
- 对会互换的唯一字段，采用临时值两阶段更新。
- 临时值要全局唯一，并避开正常业务编码空间。
- 新增、更新、删除尽量放在同一个事务里，避免半同步状态。

## 总结

批量同步最难的不是算出目标列表，而是让数据库从旧状态安全地走到新状态。最终状态合法，不代表每一步更新都合法；业务上允许重排，不代表数据库唯一索引会自动理解你的意图。

用稳定业务键做匹配，用删除前校验保护已有数据，用临时编码避让唯一索引冲突，这三个动作组合起来，就能让批量同步既可靠，又不会把正常重排误伤成异常。
