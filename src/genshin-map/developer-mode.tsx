import { useState, useRef, useEffect } from "react";
import { useSnapshot } from "valtio";
import { MarkerLayer, CustomLayer } from "@canvaskit-map/react";
import { Layer } from "@canvaskit-map/core";
import { Canvas, Paint, Path } from "canvaskit-wasm";
import { state, toggleDeveloperMode, toggleDrawing, completePath, clearAllPaths, MapPoint, setSelectedPathIndex, toggleAnimation, setAnimationSpeed } from "./state";
import { zIndex } from "./index";

interface PathPoint {
  x: number;
  y: number;
  pathIndex: number;
  pointIndex: number;
  type: 'start' | 'end' | 'middle';
}

// 路径线条绘制层
class PathLineLayer extends Layer {
  private _paint?: Paint;
  private _selectedPaint?: Paint;
  private paths: MapPoint[][];
  private selectedPathIndex: number;

  constructor(paths: MapPoint[][], selectedPathIndex: number = -1) {
    super({ zIndex: zIndex.developerPath - 1 }); // 线条在点位下方
    this.paths = paths;
    this.selectedPathIndex = selectedPathIndex;
  }

  async init() {
    // 普通路径画笔
    this._paint = new this.canvaskit!.Paint();
    this._paint.setStyle(this.canvaskit!.PaintStyle.Stroke);
    this._paint.setStrokeWidth(3);
    this._paint.setStrokeCap(this.canvaskit!.StrokeCap.Round);
    this._paint.setStrokeJoin(this.canvaskit!.StrokeJoin.Round);
    this._paint.setAntiAlias(true);

    // 选中路径画笔
    this._selectedPaint = new this.canvaskit!.Paint();
    this._selectedPaint.setStyle(this.canvaskit!.PaintStyle.Stroke);
    this._selectedPaint.setStrokeWidth(5);
    this._selectedPaint.setStrokeCap(this.canvaskit!.StrokeCap.Round);
    this._selectedPaint.setStrokeJoin(this.canvaskit!.StrokeJoin.Round);
    this._selectedPaint.setAntiAlias(true);
    this._selectedPaint.setColor(this.canvaskit!.Color(255, 107, 107, 1)); // #ff6b6b
  }

  draw(canvas: Canvas) {
    if (!this._paint || !this._selectedPaint) return;

    this.paths.forEach((path, pathIndex) => {
      if (path.length < 2) return;

      const isSelected = pathIndex === this.selectedPathIndex;
      const paint = isSelected ? this._selectedPaint! : this._paint!;
      
      if (!isSelected) {
        // 为不同路径设置不同颜色
        const hue = (pathIndex * 60) % 360;
        const color = this.hslToRgb(hue / 360, 0.7, 0.5);
        paint.setColor(this.canvaskit!.Color(color.r, color.g, color.b, 1));
      }

      // 创建路径
      const skPath = new this.canvaskit!.Path();
      skPath.moveTo(path[0].x, path[0].y);
      
      for (let i = 1; i < path.length; i++) {
        skPath.lineTo(path[i].x, path[i].y);
      }

      // 绘制路径
      canvas.drawPath(skPath, paint);
      
      // 如果是选中路径，添加虚线效果
      if (isSelected) {
        paint.setPathEffect(
          this.canvaskit!.PathEffect.MakeDash([10, 5], 0)
        );
        canvas.drawPath(skPath, paint);
        paint.setPathEffect(null);
      }

      skPath.delete();
    });
  }

  // HSL to RGB 转换
  private hslToRgb(h: number, s: number, l: number) {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  }
}

// 获取所有路径点的公共函数
function getAllPathPoints(developerMode: any) {
  const startPoints: PathPoint[] = [];
  const endPoints: PathPoint[] = [];
  const middlePoints: PathPoint[] = [];
  
  // 添加已完成路径的点
  developerMode.completedPaths.forEach((path: MapPoint[], pathIndex: number) => {
    path.forEach((point: MapPoint, pointIndex: number) => {
      const pathPoint = {
        x: point.x,
        y: point.y,
        pathIndex,
        pointIndex,
        type: pointIndex === 0 ? 'start' as const : 
              pointIndex === path.length - 1 ? 'end' as const : 'middle' as const
      };
      
      if (pathPoint.type === 'start') {
        startPoints.push(pathPoint);
      } else if (pathPoint.type === 'end') {
        endPoints.push(pathPoint);
      } else {
        middlePoints.push(pathPoint);
      }
    });
  });
  
  // 添加当前路径的点
  if (developerMode.currentPath.length > 0) {
    const currentPathIndex = developerMode.completedPaths.length;
    developerMode.currentPath.forEach((point: MapPoint, pointIndex: number) => {
      const pathPoint = {
        x: point.x,
        y: point.y,
        pathIndex: currentPathIndex,
        pointIndex,
        type: pointIndex === 0 ? 'start' as const : 
              pointIndex === developerMode.currentPath.length - 1 ? 'end' as const : 'middle' as const
      };
      
      if (pathPoint.type === 'start') {
        startPoints.push(pathPoint);
      } else if (pathPoint.type === 'end') {
        endPoints.push(pathPoint);
      } else {
        middlePoints.push(pathPoint);
      }
    });
  }
  
  return { startPoints, endPoints, middlePoints };
}

// 获取所有路径（包括当前路径）
function getAllPaths(developerMode: any): MapPoint[][] {
  const paths = [...developerMode.completedPaths];
  if (developerMode.currentPath.length > 1) {
    paths.push(developerMode.currentPath);
  }
  return paths;
}

// 路径标记组件 - 在CanvaskitMap内部使用
export function DeveloperPathMarkers() {
  const { developerMode } = useSnapshot(state);
  const [animationPosition, setAnimationPosition] = useState({ x: 0, y: 0 });
  
  if (!developerMode.isActive) {
    return null;
  }

  const { startPoints, endPoints, middlePoints } = getAllPathPoints(developerMode);
  const allPaths = getAllPaths(developerMode);
  const { selectedPathIndex, isAnimating } = developerMode;

  console.log('🎨 DeveloperPathMarkers 渲染:', {
    isActive: developerMode.isActive,
    startPoints: startPoints.length,
    endPoints: endPoints.length,
    middlePoints: middlePoints.length,
    总计: startPoints.length + endPoints.length + middlePoints.length,
    路径数量: allPaths.length
  });

  // 动画逻辑
  useEffect(() => {
    if (!isAnimating || selectedPathIndex < 0 || !allPaths[selectedPathIndex]) {
      return;
    }

    const path = allPaths[selectedPathIndex];
    if (path.length < 2) return;

    let currentIndex = 0;
    let progress = 0;
    const speed = 0.02; // 动画速度

    const animate = () => {
      if (currentIndex >= path.length - 1) {
        currentIndex = 0;
        progress = 0;
      }

      const start = path[currentIndex];
      const end = path[currentIndex + 1];
      
      if (start && end) {
        const x = start.x + (end.x - start.x) * progress;
        const y = start.y + (end.y - start.y) * progress;
        setAnimationPosition({ x, y });
      }

      progress += speed;
      if (progress >= 1) {
        progress = 0;
        currentIndex++;
      }

      if (isAnimating) {
        requestAnimationFrame(animate);
      }
    };

    const animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [isAnimating, selectedPathIndex, allPaths]);

  return (
    <>
      {/* 路径线条层 */}
      {allPaths.length > 0 && (
        <CustomLayer
          key={`paths-${allPaths.length}-${selectedPathIndex}`}
          createLayer={() => new PathLineLayer(allPaths, selectedPathIndex)}
        />
      )}

      {/* 起点标记 - 绿色 */}
      {startPoints.length > 0 && (
        <MarkerLayer
          items={startPoints}
          zIndex={zIndex.developerPath}
        >
          <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-lg" />
        </MarkerLayer>
      )}

      {/* 终点标记 - 红色 */}
      {endPoints.length > 0 && (
        <MarkerLayer
          items={endPoints}
          zIndex={zIndex.developerPath}
        >
          <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-lg" />
        </MarkerLayer>
      )}

      {/* 中间点标记 - 黄色 */}
      {middlePoints.length > 0 && (
        <MarkerLayer
          items={middlePoints}
          zIndex={zIndex.developerPath}
        >
          <div className="w-3 h-3 rounded-full bg-yellow-400 border-2 border-white shadow-lg" />
        </MarkerLayer>
      )}

      {/* 动画标记 */}
      {isAnimating && selectedPathIndex >= 0 && (
        <MarkerLayer
          items={[{ x: animationPosition.x, y: animationPosition.y }]}
          zIndex={zIndex.developerPath + 1}
        >
          <div className="w-6 h-6 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 border-2 border-white shadow-lg animate-pulse">
            <div className="absolute inset-0 rounded-full bg-white animate-ping opacity-75"></div>
          </div>
        </MarkerLayer>
      )}
    </>
  );
}

// UI面板组件 - 在CanvaskitMap外部使用
export function DeveloperMode() {
  const { developerMode, tilemap } = useSnapshot(state);
  
  const animatedElementRef = useRef<HTMLDivElement>(null);

  // 播放/暂停动画
  const handleToggleAnimation = () => {
    const allPaths = getAllPaths(developerMode);
    if (allPaths.length === 0) {
      alert('请先绘制至少一条路径！');
      return;
    }
    toggleAnimation();
  };

  // 导出路径数据
  const exportPaths = () => {
    const allPaths = getAllPaths(developerMode);
    
    const pathData = {
      mapCoordinatePaths: allPaths,
      totalPaths: allPaths.length,
      totalPoints: allPaths.reduce((sum, path) => sum + path.length, 0),
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(pathData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `genshin-map-paths-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!developerMode.isActive) {
    return (
      <div className="absolute top-4 right-4 z-30">
        <button
          onClick={toggleDeveloperMode}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow-lg"
        >
          路径动画开发者模式
        </button>
      </div>
    );
  }

  const { startPoints, endPoints, middlePoints } = getAllPathPoints(developerMode);
  const totalPoints = startPoints.length + endPoints.length + middlePoints.length;
  const allPaths = getAllPaths(developerMode);
  const { selectedPathIndex, isAnimating, animationSpeed } = developerMode;

  return (
    <div className="absolute top-4 right-4 z-30">
      <div className="bg-white shadow-lg rounded-lg p-4 w-80 max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">路径动画开发者模式</h3>
          <button
            onClick={toggleDeveloperMode}
            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
          >
            关闭
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={toggleDrawing}
              className={`flex-1 px-3 py-2 rounded text-sm font-medium ${
                developerMode.isDrawing
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {developerMode.isDrawing ? '停止绘制' : '开始绘制'}
            </button>
            
            <button
              onClick={completePath}
              className="px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
              disabled={developerMode.currentPath.length < 2}
            >
              完成当前路径
            </button>
          </div>

          <button
            onClick={clearAllPaths}
            className="w-full px-3 py-2 bg-red-500 text-white rounded text-sm hover:bg-red-600"
          >
            清除所有路径
          </button>

          {/* 路径选择和动画控制 */}
          {allPaths.length > 0 && (
            <div className="border-t pt-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择路径进行动画 ({allPaths.length} 条)
              </label>
              <select
                value={selectedPathIndex}
                onChange={(e) => setSelectedPathIndex(Number((e.target as HTMLSelectElement).value))}
                className="w-full p-2 border border-gray-300 rounded text-sm mb-2"
              >
                {allPaths.map((path, index) => (
                  <option key={index} value={index}>
                    路径 {index + 1} ({path.length} 点)
                  </option>
                ))}
              </select>

                             <div className="flex gap-2">
                 <button
                   onClick={handleToggleAnimation}
                   className={`flex-1 px-3 py-2 rounded text-sm ${
                     isAnimating
                       ? 'bg-red-500 text-white hover:bg-red-600'
                       : 'bg-green-500 text-white hover:bg-green-600'
                   }`}
                 >
                   {isAnimating ? '⏸️ 停止动画' : '▶️ 播放动画'}
                 </button>
               </div>

              <div className="mt-2">
                <label className="block text-sm text-gray-600 mb-1">动画速度</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={animationSpeed}
                  onChange={(e) => setAnimationSpeed(Number((e.target as HTMLInputElement).value))}
                  className="w-full"
                />
                <div className="text-xs text-gray-500 text-center">{animationSpeed}x</div>
              </div>
            </div>
          )}

          <button
            onClick={exportPaths}
            className="w-full px-3 py-2 bg-purple-500 text-white rounded text-sm hover:bg-purple-600"
            disabled={allPaths.length === 0}
          >
            导出路径数据
          </button>

          <div className="text-sm text-gray-600 bg-gray-100 p-2 rounded">
            <div>当前路径: {developerMode.currentPath.length} 点</div>
            <div>已完成路径: {developerMode.completedPaths.length} 条</div>
            <div>总路径: {allPaths.length} 条</div>
            <div>总路径点: {totalPoints} 个</div>
            <div className="text-xs mt-1 text-blue-600">
              状态: 开发模式={developerMode.isActive ? '开' : '关'}, 绘制={developerMode.isDrawing ? '开' : '关'}
            </div>
            <div className="text-xs text-purple-600">
              地图状态: {tilemap ? '已加载' : '未加载'}
            </div>
          </div>

          {developerMode.isDrawing && (
            <div className="text-sm text-blue-600 bg-blue-100 p-2 rounded">
              💡 点击地图上的任意位置添加路径点
              <br />📍 使用与传送点相同的坐标系统
              <br />🔍 检查控制台查看调试信息
            </div>
          )}

          <div className="text-xs text-gray-500">
            <div>🟢 绿色: 起点 ({startPoints.length})</div>
            <div>🔴 红色: 终点 ({endPoints.length})</div>
            <div>🟡 黄色: 中间点 ({middlePoints.length})</div>
            <div>🟠 橙色动画球: 运动轨迹</div>
            <div>━ 路径线条: 连接各点</div>
          </div>

          {/* 调试信息 */}
          <div className="text-xs text-gray-400 bg-yellow-50 p-2 rounded">
            <div className="font-semibold">🐛 调试信息:</div>
            <div>MarkerLayer位置: CanvaskitMap内部 ✓</div>
            <div>路径线条: CustomLayer ✓</div>
            <div>起点数量: {startPoints.length}</div>
            <div>终点数量: {endPoints.length}</div>
            <div>中间点数量: {middlePoints.length}</div>
            <div>路径数量: {allPaths.length}</div>
            {isAnimating && (
              <div>动画状态: 运行中 ✓ 路径{selectedPathIndex + 1}</div>
            )}
            {developerMode.currentPath.length > 0 && (
              <div>最后添加的点: ({developerMode.currentPath[developerMode.currentPath.length - 1].x.toFixed(1)}, {developerMode.currentPath[developerMode.currentPath.length - 1].y.toFixed(1)})</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 