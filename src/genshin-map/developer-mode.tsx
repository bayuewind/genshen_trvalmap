import { useState, useRef, useEffect } from "react";
import { useSnapshot } from "valtio";
import { MarkerLayer } from "@canvaskit-map/react";
// 已移除 CanvasKit 相关导入，改用 MarkerLayer + SVG
import { state, toggleDeveloperMode, toggleDrawing, completePath, clearAllPaths, MapPoint, setSelectedPathIndex, toggleAnimation, setAnimationSpeed } from "./state";
import { zIndex } from "./index";

// 🔧 已切换到 MarkerLayer + SVG 方案，移除 CanvasKit 绘制代码

interface PathPoint {
  x: number;
  y: number;
  pathIndex: number;
  pointIndex: number;
  type: 'start' | 'end' | 'middle';
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
              pointIndex === developerMode.currentPath.length - 1 && developerMode.currentPath.length > 1 ? 'end' as const : 'middle' as const
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

// 优化的SVG路径线条组件 - 基于高德地图绘制原理
function OptimizedPathLines({ paths, selectedPathIndex }: { paths: MapPoint[][], selectedPathIndex: number }) {
  if (paths.length === 0) return null;

  console.log('🎨 OptimizedPathLines 渲染:', {
    路径数量: paths.length,
    选中路径: selectedPathIndex,
    详细路径: paths.map((path, i) => ({
      路径索引: i,
      点数: path.length,
      起点: path[0],
      终点: path[path.length - 1]
    }))
  });

  return (
    <>
      {paths.map((path, pathIndex) => {
        if (path.length < 2) return null;
        
        const isSelected = pathIndex === selectedPathIndex;
        const color = isSelected ? '#ff0000' : `hsl(${(pathIndex * 80) % 360}, 100%, 50%)`;
        const strokeWidth = isSelected ? 8 : 4;
        
        // 计算路径的边界框
        const xs = path.map(p => p.x);
        const ys = path.map(p => p.y);
        const minX = Math.min(...xs) - 20;
        const minY = Math.min(...ys) - 20;
        const maxX = Math.max(...xs) + 20;
        const maxY = Math.max(...ys) + 20;
        const width = maxX - minX;
        const height = maxY - minY;
        
        // 创建路径字符串
        const pathData = path.map((point, index) => {
          const x = point.x - minX;
          const y = point.y - minY;
          return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
        }).join(' ');
        
        console.log(`🔗 绘制优化路径 ${pathIndex + 1}:`, {
          选中状态: isSelected,
          线条颜色: color,
          线条宽度: strokeWidth,
          路径点数: path.length,
          边界框: { minX, minY, width, height },
          路径数据: pathData
        });
        
        return (
          <MarkerLayer
            key={`optimized-path-${pathIndex}`}
            items={[{ x: minX, y: minY }]}
            zIndex={zIndex.developerPath - 1}
          >
            <svg
              width={width}
              height={height}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'none',
                overflow: 'visible',
                zIndex: 1000
              }}
            >
              {/* 发光效果（选中路径） */}
              {isSelected && (
                <path
                  d={pathData}
                  stroke={color}
                  strokeWidth={strokeWidth + 8}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.3}
                />
              )}
              {/* 主路径线 */}
              <path
                d={pathData}
                stroke={color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.9}
                strokeDasharray={isSelected ? "12,6" : "none"}
              />
            </svg>
          </MarkerLayer>
        );
      })}
    </>
  );
}

// SVG路径线条组件 - 每个线段单独渲染以确保可见性
function SVGPathLines({ paths, selectedPathIndex }: { paths: MapPoint[][], selectedPathIndex: number }) {
  if (paths.length === 0) return null;

  console.log('🎨 SVGPathLines 渲染:', {
    路径数量: paths.length,
    选中路径: selectedPathIndex,
    详细路径: paths.map((path, i) => ({
      路径索引: i,
      点数: path.length,
      点位: path
    }))
  });

  return (
    <>
      {paths.map((path, pathIndex) => {
        if (path.length < 2) return null;
        
        const isSelected = pathIndex === selectedPathIndex;
        const color = isSelected ? '#ff0000' : `hsl(${(pathIndex * 80) % 360}, 100%, 50%)`;
        const strokeWidth = isSelected ? 8 : 4;
        
        console.log(`🔗 绘制SVG路径 ${pathIndex + 1}:`, {
          选中状态: isSelected,
          线条颜色: color,
          线条宽度: strokeWidth,
          路径点数: path.length,
          路径点: path
        });

        // 为每对相邻点创建SVG线段
        const lineSegments = [];
        for (let i = 0; i < path.length - 1; i++) {
          const start = path[i];
          const end = path[i + 1];
          
          // 计算边界框以确保SVG足够大
          const minX = Math.min(start.x, end.x) - 10;
          const minY = Math.min(start.y, end.y) - 10;
          const maxX = Math.max(start.x, end.x) + 10;
          const maxY = Math.max(start.y, end.y) + 10;
          const width = maxX - minX;
          const height = maxY - minY;
          
          console.log(`  📏 线段 ${i + 1}:`, {
            起点: start,
            终点: end,
            SVG尺寸: { width, height, minX, minY }
          });
          
          lineSegments.push(
            <MarkerLayer
              key={`svg-line-${pathIndex}-${i}`}
              items={[{ x: minX, y: minY }]}
              zIndex={zIndex.developerPath - 1}
            >
              <svg
                width={width}
                height={height}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  pointerEvents: 'none',
                  overflow: 'visible',
                  zIndex: 1000
                }}
              >
                {/* 发光效果背景 */}
                {isSelected && (
                  <line
                    x1={start.x - minX}
                    y1={start.y - minY}
                    x2={end.x - minX}
                    y2={end.y - minY}
                    stroke={color}
                    strokeWidth={strokeWidth + 4}
                    strokeLinecap="round"
                    opacity={0.3}
                  />
                )}
                {/* 主线条 */}
                <line
                  x1={start.x - minX}
                  y1={start.y - minY}
                  x2={end.x - minX}
                  y2={end.y - minY}
                  stroke={color}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  opacity={0.9}
                  strokeDasharray={isSelected ? "8,4" : "none"}
                />
              </svg>
            </MarkerLayer>
          );
        }
        
        return <div key={`path-${pathIndex}`}>{lineSegments}</div>;
      })}
    </>
  );
}

// 测试线条组件 - 用固定位置验证MarkerLayer是否工作
function TestLines({ paths }: { paths: MapPoint[][] }) {
  if (paths.length === 0) return null;
  
  const firstPath = paths[0];
  if (firstPath.length < 1) return null;
  
  console.log('🧪 TestLines 测试组件:', {
    测试位置: firstPath[0],
    测试说明: '在第一个路径点显示明显的测试标记'
  });
  
  return (
    <MarkerLayer
      items={[{ x: firstPath[0].x, y: firstPath[0].y }]}
      zIndex={zIndex.developerPath + 10}
    >
      <div
        style={{
          width: '20px',
          height: '20px',
          backgroundColor: '#00ff00',
          border: '3px solid #000000',
          borderRadius: '50%',
          position: 'absolute',
          transform: 'translate(-50%, -50%)',
          boxShadow: '0 0 20px #00ff00',
          zIndex: 999
        }}
      />
    </MarkerLayer>
  );
}

// CanvasKit 原生路径绘制组件
function PathLines({ paths, selectedPathIndex }: { paths: MapPoint[][], selectedPathIndex: number }) {
  // 获取所有路径，包括当前绘制的路径
  const allPaths = getAllPaths({ completedPaths: paths, currentPath: [] });
  
  console.log('🎨 PathLines 组件渲染:', {
    输入路径数: paths.length,
    处理后路径数: allPaths.length,
    选中路径索引: selectedPathIndex,
    坐标系统: 'MarkerLayer + SVG (与路径点一致)'
  });

  if (allPaths.length === 0) {
    return null;
  }

  return (
    <>
      {/* 测试层级：固定位置的红色圆圈 */}
      <MarkerLayer
        items={[{ x: 0, y: 0 }]}
        zIndex={zIndex.developerPath + 10}
      >
        <div 
          className="w-10 h-10 rounded-full bg-red-500 border-4 border-white shadow-lg"
          style={{ 
            position: 'absolute',
            left: -20,
            top: -20,
            zIndex: 9999
          }}
        >
          <div className="text-white text-xs text-center mt-1">TEST</div>
        </div>
      </MarkerLayer>

      {/* 🔧 使用 MarkerLayer + SVG 绘制路径线 - 与路径点使用相同坐标系统 */}
      {allPaths.map((path, pathIndex) => {
        if (path.length < 2) return null;

        const isSelected = pathIndex === selectedPathIndex;
        
        // 计算路径边界，用于 SVG viewBox
        const xs = path.map(p => p.x);
        const ys = path.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        // 添加边距
        const padding = 50;
        const viewBoxWidth = (maxX - minX) + (padding * 2);
        const viewBoxHeight = (maxY - minY) + (padding * 2);
        const viewBoxX = minX - padding;
        const viewBoxY = minY - padding;

        // 检查 SVG 尺寸是否有效
        if (viewBoxWidth <= 0 || viewBoxHeight <= 0) {
          console.warn(`⚠️ 路径 ${pathIndex + 1} SVG 尺寸无效:`, {
            viewBoxWidth,
            viewBoxHeight,
            边界: { minX, maxX, minY, maxY },
            点数: path.length
          });
          return null;
        }

        // 创建SVG路径数据
        const pathData = `M ${path[0].x - viewBoxX} ${path[0].y - viewBoxY} ` +
          path.slice(1).map(point => `L ${point.x - viewBoxX} ${point.y - viewBoxY}`).join(' ');

        // 生成颜色 - 增强可见性
        const hue = (pathIndex * 80) % 360;
        const color = isSelected ? '#ff0000' : `hsl(${hue}, 100%, 50%)`;
        const strokeWidth = isSelected ? 12 : 8; // 增加线条宽度

        console.log(`🗺️ 绘制路径 ${pathIndex + 1}:`, {
          点数: path.length,
          选中状态: isSelected,
          颜色: color,
          线条宽度: strokeWidth,
          发光宽度: strokeWidth + 6,
          边界: { minX, maxX, minY, maxY },
          viewBox: `${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`,
          SVG尺寸: { width: viewBoxWidth, height: viewBoxHeight },
          路径数据: pathData.substring(0, 100) + '...',
          前几个点: path.slice(0, 3).map(p => ({ x: p.x, y: p.y }))
        });

        return (
          <MarkerLayer
            key={`path-${pathIndex}`}
            items={[{ x: minX + viewBoxWidth/2, y: minY + viewBoxHeight/2 }]}
            zIndex={zIndex.developerPath}
          >
            <svg
              width={viewBoxWidth}
              height={viewBoxHeight}
              viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
              style={{
                position: 'absolute',
                left: -viewBoxWidth/2,
                top: -viewBoxHeight/2,
                pointerEvents: 'none',
                overflow: 'visible',
                border: '2px solid lime', // 调试：显示 SVG 边界
                backgroundColor: 'rgba(255, 0, 0, 0.1)', // 调试：半透明背景
                zIndex: 9999
              }}
            >
              {/* 选中路径的发光效果 */}
              {isSelected && (
                <path
                  d={pathData}
                  fill="none"
                  stroke={color}
                  strokeWidth={strokeWidth + 6}
                  strokeOpacity={0.3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              
              {/* 白色描边 */}
              <path
                d={pathData}
                fill="none"
                stroke="#ffffff"
                strokeWidth={strokeWidth + 4}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.8}
              />
              
              {/* 主路径线 */}
              <path
                d={pathData}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={1}
              />
              
              {/* 调试：起点和终点标记 */}
              <circle
                cx={path[0].x - viewBoxX}
                cy={path[0].y - viewBoxY}
                r={isSelected ? 8 : 5}
                fill="#00ff00"
                stroke="#000"
                strokeWidth={2}
                opacity={0.8}
              />
              <circle
                cx={path[path.length - 1].x - viewBoxX}
                cy={path[path.length - 1].y - viewBoxY}
                r={isSelected ? 6 : 4}
                fill="#0000ff"
                stroke="#000"
                strokeWidth={2}
                opacity={0.8}
              />
            </svg>
          </MarkerLayer>
        );
      })}
      
      {/* 保留测试标记 */}
      <TestLines paths={allPaths} />
    </>
  );
}

// 路径标记组件 - 在CanvaskitMap内部使用
export function DeveloperPathMarkers() {
  const { developerMode } = useSnapshot(state);
  const [animationPosition, setAnimationPosition] = useState({ x: 0, y: 0 });
  const [showAnimationMarker, setShowAnimationMarker] = useState(false);
  
  if (!developerMode.isActive) {
    return null;
  }

  const { startPoints, endPoints, middlePoints } = getAllPathPoints(developerMode);
  const allPaths = getAllPaths(developerMode);
  const { selectedPathIndex, isAnimating, animationSpeed } = developerMode;

  console.log('🎨 DeveloperPathMarkers 渲染:', {
    isActive: developerMode.isActive,
    isDrawing: developerMode.isDrawing,
    currentPathLength: developerMode.currentPath.length,
    completedPaths: developerMode.completedPaths.length,
    startPoints: startPoints.length,
    endPoints: endPoints.length,
    middlePoints: middlePoints.length,
    总计: startPoints.length + endPoints.length + middlePoints.length,
    路径数量: allPaths.length,
    选中路径: selectedPathIndex,
    动画状态: isAnimating
  });

  // 动画逻辑
  useEffect(() => {
    if (!isAnimating || selectedPathIndex < 0 || !allPaths[selectedPathIndex]) {
      // 如果动画停止但有选中的路径，隐藏动画标记
      if (!isAnimating && selectedPathIndex >= 0) {
        setShowAnimationMarker(false);
      }
      return;
    }

    const path = allPaths[selectedPathIndex];
    if (path.length < 2) return;

    // 显示动画标记
    setShowAnimationMarker(true);

    let currentIndex = 0;
    let progress = 0;
    const speed = 0.02 * (animationSpeed / 3); // 根据速度调整

    const animate = () => {
      // 检查动画是否完成
      if (currentIndex >= path.length - 1) {
        // 将动画位置设置为路径的最后一个点
        const lastPoint = path[path.length - 1];
        setAnimationPosition({ x: lastPoint.x, y: lastPoint.y });
        
        // 动画完成，停止动画
        state.developerMode.isAnimating = false;
        console.log('🎬 动画播放完成，自动停止');
        return;
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
  }, [isAnimating, selectedPathIndex, allPaths, animationSpeed]);

  return (
    <>
      {/* 路径线条 */}
      <PathLines paths={allPaths} selectedPathIndex={selectedPathIndex} />

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
      {showAnimationMarker && selectedPathIndex >= 0 && allPaths[selectedPathIndex] && (
        <MarkerLayer
          items={[{ x: animationPosition.x, y: animationPosition.y }]}
          zIndex={zIndex.developerPath + 1}
        >
          <div className={`w-6 h-6 rounded-full border-2 border-white shadow-lg ${
            isAnimating 
              ? 'bg-gradient-to-r from-yellow-400 to-orange-500 animate-pulse' 
              : 'bg-gradient-to-r from-green-400 to-blue-500'
          }`}>
            {isAnimating && (
              <div className="absolute inset-0 rounded-full bg-white animate-ping opacity-75"></div>
            )}
          </div>
        </MarkerLayer>
      )}
    </>
  );
}

// UI面板组件 - 在CanvaskitMap外部使用
export function DeveloperMode() {
  const { developerMode, tilemap } = useSnapshot(state);
  const [mouseCoords, setMouseCoords] = useState<{x: number, y: number} | null>(null);
  
  const animatedElementRef = useRef<HTMLDivElement>(null);

  // 监听鼠标移动获取地图坐标
  useEffect(() => {
    if (!tilemap) return;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = (tilemap as any).canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      // 简单的屏幕坐标转地图坐标（基于地图缩放和偏移）
      // 这里使用的是CanvaskitMap的内部坐标系
      setMouseCoords({ x: Math.round(x), y: Math.round(y) });
    };

    (tilemap as any).canvas.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      (tilemap as any).canvas?.removeEventListener('mousemove', handleMouseMove);
    };
  }, [tilemap]);

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

          <button
            onClick={() => {
              // 获取地图中心作为参考点
              const { tilemap } = state;
              if (!tilemap) return;
              
              // 使用地图中心附近的坐标创建测试路径
              const centerX = 8704; // 地图宽度一半 (17408/2)
              const centerY = 8704; // 地图高度一半 (17408/2)
              
              const testPath: MapPoint[] = [
                { x: centerX - 500, y: centerY - 200 },  // 中心左上
                { x: centerX - 200, y: centerY + 100 },  // 中心偏右下
                { x: centerX + 100, y: centerY - 100 },  // 中心右上
                { x: centerX + 400, y: centerY + 200 },  // 中心右下
                { x: centerX + 200, y: centerY + 400 }   // 中心下方
              ];
              
              state.developerMode.completedPaths.push(testPath);
              console.log('🧪 添加测试路径 (使用地图坐标):', {
                地图中心: { x: centerX, y: centerY },
                测试路径: testPath
              });
            }}
            className="w-full px-3 py-2 bg-purple-500 text-white rounded text-sm hover:bg-purple-600"
          >
            🧪 添加测试路径 (地图中心)
          </button>

          {mouseCoords && (
            <button
              onClick={() => {
                // 使用当前鼠标位置附近创建测试路径
                const baseX = mouseCoords.x;
                const baseY = mouseCoords.y;
                
                const testPath: MapPoint[] = [
                  { x: baseX - 100, y: baseY - 50 },    // 左上
                  { x: baseX - 50, y: baseY + 30 },     // 左下
                  { x: baseX + 20, y: baseY - 20 },     // 中心
                  { x: baseX + 80, y: baseY + 40 },     // 右下
                  { x: baseX + 50, y: baseY + 80 }      // 下方
                ];
                
                state.developerMode.completedPaths.push(testPath);
                console.log('🎯 添加鼠标位置测试路径:', {
                  鼠标位置: mouseCoords,
                  测试路径: testPath
                });
              }}
              className="w-full px-3 py-2 bg-cyan-500 text-white rounded text-sm hover:bg-cyan-600"
            >
              🎯 鼠标位置测试路径 ({mouseCoords.x}, {mouseCoords.y})
            </button>
          )}

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

          <input
            type="file"
            accept=".json"
            onChange={(e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                  try {
                    const data = JSON.parse((event.target as FileReader)?.result as string);
                    if (data.mapCoordinatePaths && Array.isArray(data.mapCoordinatePaths)) {
                      state.developerMode.completedPaths = [...data.mapCoordinatePaths];
                      console.log('📥 导入路径数据:', {
                        路径数量: data.mapCoordinatePaths.length,
                        总点数: data.totalPoints,
                        数据: data.mapCoordinatePaths
                      });
                      alert(`成功导入 ${data.mapCoordinatePaths.length} 条路径，共 ${data.totalPoints} 个点`);
                    } else {
                      alert('无效的路径数据格式');
                    }
                  } catch (error) {
                    console.error('解析JSON失败:', error);
                    alert('文件格式错误');
                  }
                };
                reader.readAsText(file);
              }
            }}
            className="hidden"
            id="import-paths"
          />
          <label
            htmlFor="import-paths"
            className="w-full px-3 py-2 bg-indigo-500 text-white rounded text-sm hover:bg-indigo-600 cursor-pointer block text-center"
          >
            📥 导入路径数据
          </label>

          {/* 地图配置调试信息 */}
          <div className="text-xs text-gray-500 bg-yellow-50 p-2 rounded border">
            <div className="font-semibold text-gray-700 mb-1">🗺️ 地图配置调试:</div>
            {tilemap ? (
              <div className="space-y-1">
                <div>地图尺寸: {tilemap.size?.[0]} × {tilemap.size?.[1]}</div>
                <div>地图中心: ({(tilemap.size?.[0] || 0) / 2}, {(tilemap.size?.[1] || 0) / 2})</div>
                <div>缩放级别: {(tilemap as any).zoom?.toFixed(2) || '未知'}</div>
                <div className="text-red-600">
                  ⚠️ 负数Y坐标可能超出可视范围
                </div>
              </div>
            ) : (
              <div>地图未加载</div>
            )}
          </div>

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
            {mouseCoords && (
              <div className="text-xs text-green-600 mt-1">
                🖱️ 鼠标坐标: ({mouseCoords.x}, {mouseCoords.y})
              </div>
            )}
          </div>

          {developerMode.isDrawing && (
            <div className="text-sm text-blue-600 bg-blue-100 p-2 rounded">
              💡 点击地图上的任意位置添加路径点
              <br />📍 当前绘制路径 {developerMode.completedPaths.length + 1}
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
            <div>路径线条: SVG绘制 ✓</div>
            <div>起点数量: {startPoints.length}</div>
            <div>终点数量: {endPoints.length}</div>
            <div>中间点数量: {middlePoints.length}</div>
            <div>路径数量: {allPaths.length}</div>
            <div>当前选中路径: {selectedPathIndex + 1}</div>
            {isAnimating && (
              <div>动画状态: 运行中 ✓ 路径{selectedPathIndex + 1}</div>
            )}
            {developerMode.currentPath.length > 0 && (
              <div className="text-xs text-orange-600">
                📍 最后添加的点: ({developerMode.currentPath[developerMode.currentPath.length - 1].x.toFixed(1)}, {developerMode.currentPath[developerMode.currentPath.length - 1].y.toFixed(1)})
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 