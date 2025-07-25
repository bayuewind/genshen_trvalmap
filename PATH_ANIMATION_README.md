# 路径动画功能使用说明

这个项目实现了从点A到点B的前进路线动画功能，支持路径规划、分段渲染和动画效果。

## 功能特性

### 1. 基础路径动画 (`PathAnimation`)
- ✅ 直线路径规划
- ✅ 固定速度前进
- ✅ 分段渲染动画
- ✅ 可配置速度、颜色、线宽

### 2. 高级路径动画 (`AdvancedPathAnimation`)
- ✅ 贝塞尔曲线路径
- ✅ 支持中间路径点 (waypoints)
- ✅ 避障算法
- ✅ 进度指示器
- ✅ 循环播放
- ✅ 半透明路径预览

## 使用方法

### 基础用法

```tsx
import { PathAnimation } from './path-animation';

// 在地图组件中使用
<PathAnimation
  startPoint={{ x: 100, y: 100 }}
  endPoint={{ x: 500, y: 300 }}
  speed={50} // 像素/秒
  pathColor="#ff0000"
  pathWidth={3}
  isActive={true}
/>
```

### 高级用法

```tsx
import { AdvancedPathAnimation } from './advanced-path-animation';

<AdvancedPathAnimation
  startPoint={{ x: 100, y: 100 }}
  endPoint={{ x: 500, y: 300 }}
  waypoints={[
    { x: 200, y: 150 },
    { x: 400, y: 200 }
  ]}
  speed={50}
  pathColor="#ff0000"
  pathWidth={3}
  isActive={true}
  showProgress={true}
  loop={false}
/>
```

### 使用动画控制器

```tsx
import { usePathAnimation } from './path-animation';

function MyComponent() {
  const { startAnimation, stopAnimation, removeAnimation } = usePathAnimation();

  const handleStart = () => {
    startAnimation('path1', {
      startPoint: { x: 100, y: 100 },
      endPoint: { x: 500, y: 300 },
      speed: 50,
      isActive: true
    });
  };

  const handleStop = () => {
    stopAnimation('path1');
  };

  const handleRemove = () => {
    removeAnimation('path1');
  };

  return (
    <div>
      <button onClick={handleStart}>开始动画</button>
      <button onClick={handleStop}>停止动画</button>
      <button onClick={handleRemove}>移除动画</button>
    </div>
  );
}
```

## 技术实现

### 1. 路径规划算法

#### 直线路径
```typescript
function findPath(start: PathPoint, end: PathPoint): PathPoint[] {
  const path: PathPoint[] = [];
  const steps = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y));
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = start.x + (end.x - start.x) * t;
    const y = start.y + (end.y - start.y) * t;
    path.push({ x: Math.round(x), y: Math.round(y) });
  }
  
  return path;
}
```

#### 贝塞尔曲线路径
```typescript
function generateBezierPath(points: PathPoint[], segments: number = 50): PathPoint[] {
  const path: PathPoint[] = [];
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = bezierInterpolate(points, t);
    path.push(point);
  }
  
  return path;
}
```

### 2. 路径分段

将长路径分成多个小段，实现邮票式的分段渲染：

```typescript
function segmentPath(path: PathPoint[], segmentLength: number = 10): PathPoint[][] {
  const segments: PathPoint[][] = [];
  let currentSegment: PathPoint[] = [];
  
  for (let i = 0; i < path.length; i++) {
    currentSegment.push(path[i]);
    
    if (currentSegment.length >= segmentLength || i === path.length - 1) {
      segments.push([...currentSegment]);
      currentSegment = [];
    }
  }
  
  return segments;
}
```

### 3. 动画渲染

使用 CanvasKit 自定义图层实现高性能动画：

```typescript
class _PathAnimationLayer extends Layer {
  updateAnimation(currentTime: number) {
    // 计算动画进度
    const deltaTime = (currentTime - this._lastTime) / 1000;
    const segmentProgress = this._speed * deltaTime / 10;
    this._animationProgress += segmentProgress;
    
    // 更新当前段索引
    if (this._animationProgress >= 1) {
      this._currentSegmentIndex++;
      this._animationProgress = this._animationProgress % 1;
    }
  }

  draw(canvas: Canvas) {
    // 绘制已完成的路径段
    for (let i = 0; i < this._currentSegmentIndex; i++) {
      this._drawSegment(canvas, this._segments[i]);
    }
    
    // 绘制当前正在动画的路径段
    if (this._currentSegmentIndex < this._segments.length) {
      this._drawPartialSegment(canvas, this._segments[this._currentSegmentIndex]);
    }
  }
}
```

## 配置选项

### PathAnimation 配置

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| startPoint | PathPoint | - | 起点坐标 |
| endPoint | PathPoint | - | 终点坐标 |
| speed | number | 50 | 移动速度（像素/秒） |
| pathColor | string | "#ff0000" | 路径颜色 |
| pathWidth | number | 3 | 路径线宽 |
| isActive | boolean | true | 是否激活动画 |

### AdvancedPathAnimation 配置

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| waypoints | PathPoint[] | [] | 中间路径点 |
| showProgress | boolean | true | 是否显示进度指示器 |
| loop | boolean | false | 是否循环播放 |

## 性能优化

1. **分段渲染**: 将长路径分成小段，避免一次性渲染大量数据
2. **CanvasKit 图层**: 使用原生 CanvasKit 图层，性能优于 DOM 渲染
3. **动画帧控制**: 使用 requestAnimationFrame 确保流畅动画
4. **内存管理**: 及时清理动画图层和定时器

## 扩展功能

### 1. 添加避障算法
```typescript
function avoidObstacles(path: PathPoint[], obstacles: PathPoint[]): PathPoint[] {
  // 实现避障逻辑
  return adjustedPath;
}
```

### 2. 支持多种路径类型
- 直线路径
- 贝塞尔曲线
- A* 寻路算法
- 自定义路径

### 3. 动画效果
- 路径渐显
- 进度指示器
- 路径闪烁
- 颜色渐变

## 注意事项

1. **坐标系统**: 确保使用正确的地图坐标系统
2. **性能考虑**: 避免同时运行过多动画
3. **内存泄漏**: 及时清理动画资源
4. **浏览器兼容**: 确保支持 CanvasKit

## 示例场景

### 1. 传送点导航
```tsx
// 从当前位置到传送点的路径
<PathAnimation
  startPoint={playerPosition}
  endPoint={teleportPosition}
  speed={30}
  pathColor="#00ff00"
/>
```

### 2. 任务路线
```tsx
// 包含多个检查点的任务路线
<AdvancedPathAnimation
  startPoint={startPosition}
  endPoint={endPosition}
  waypoints={checkpoints}
  showProgress={true}
  loop={false}
/>
```

### 3. 探索路径
```tsx
// 循环的探索路径
<AdvancedPathAnimation
  startPoint={exploreStart}
  endPoint={exploreEnd}
  waypoints={explorePoints}
  loop={true}
  speed={20}
/>
``` 