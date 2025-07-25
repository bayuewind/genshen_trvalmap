import { MapClickEvent, MarkerItem, CanvaskitMap } from "@canvaskit-map/core";
import { proxy, ref } from "valtio";
import { proxySet } from "valtio/utils";
import { AreaItem, Marker, UndergroundMap } from "../data_pb";
import { store } from "../store";

export interface AreaItemMarker extends MarkerItem {
  marker: Marker;
  areaItem: AreaItem;
}

// 路径点接口（使用地图坐标）
export interface MapPoint {
  x: number;
  y: number;
}

export const state = proxy({
  tilemap: null as unknown as CanvaskitMap,
  zoomLevel: 0,
  undergroundEnabled: false,
  activeUndergroundMap: null as UndergroundMap | null,
  teleportVisible: true,
  markedVisible: false,
  activeMarker: null as AreaItemMarker | null,
  marked: proxySet<number>(),
  // 开发者模式状态
  developerMode: {
    isActive: false,
    isDrawing: false,
    currentPath: [] as MapPoint[],
    completedPaths: [] as MapPoint[][],
    needsRedraw: false,
    // 动画相关状态
    selectedPathIndex: 0,
    isAnimating: false,
    animationSpeed: 3,
  },
});

export async function onTilemapReady(tilemap: CanvaskitMap) {
  state.tilemap = ref(tilemap);
  onTilemapMove();
}

export async function onTilemapMove() {
  state.zoomLevel = Math.floor(state.tilemap!.zoom);
  // 当地图移动时，标记需要重绘路径
  if (state.developerMode.isActive) {
    state.developerMode.needsRedraw = true;
  }
}

export function toggleMarkedVisible() {
  state.markedVisible = !state.markedVisible;
}

export function toggleUnderground() {
  state.undergroundEnabled = !state.undergroundEnabled;
}

export function toggleTeleport() {
  state.teleportVisible = !state.teleportVisible;
}

// 开发者模式相关函数
export function toggleDeveloperMode() {
  state.developerMode.isActive = !state.developerMode.isActive;
  if (!state.developerMode.isActive) {
    // 关闭时清理状态
    state.developerMode.isDrawing = false;
    state.developerMode.currentPath = [];
    state.developerMode.completedPaths = [];
    state.developerMode.needsRedraw = false;
  }
}

export function toggleDrawing() {
  state.developerMode.isDrawing = !state.developerMode.isDrawing;
}

export function addPathPoint(mapCoordinate: number[]) {
  if (state.developerMode.isActive && state.developerMode.isDrawing && mapCoordinate.length >= 2) {
    const point: MapPoint = {
      x: mapCoordinate[0],
      y: mapCoordinate[1]
    };
    state.developerMode.currentPath.push(point);
    state.developerMode.needsRedraw = true;
    console.log('添加路径点 (地图坐标):', point);
  }
}

export function completePath() {
  if (state.developerMode.currentPath.length > 1) {
    state.developerMode.completedPaths.push([...state.developerMode.currentPath]);
    state.developerMode.currentPath = [];
    state.developerMode.needsRedraw = true;
  }
}

export function clearAllPaths() {
  state.developerMode.currentPath = [];
  state.developerMode.completedPaths = [];
  state.developerMode.needsRedraw = true;
}

// 直接使用地图坐标，不进行转换（就像传送点标记一样）
export function mapToScreenCoordinate(mapCoord: MapPoint): { x: number, y: number } {
  // 传送点标记直接使用地图坐标，我们也这样做
  return { x: mapCoord.x, y: mapCoord.y };
}

// 屏幕坐标就是地图坐标
export function screenToMapCoordinate(screenCoord: { x: number, y: number }): MapPoint {
  return { x: screenCoord.x, y: screenCoord.y };
}

export function onTilemapClick(event: MapClickEvent) {
  if (!event.markerItem) {
    state.activeMarker = null;
    state.activeUndergroundMap = null;
    
    // 如果在开发者模式下绘制，添加路径点
    if (state.developerMode.isActive && state.developerMode.isDrawing && event.coordinate) {
      console.log('🎯 地图点击事件 - 直接使用地图坐标:', {
        原始坐标: event.coordinate,
        地图点: { x: event.coordinate[0], y: event.coordinate[1] }
      });
      
      addPathPoint(event.coordinate);
    } else {
      console.log("🖱️ 普通点击:", event.coordinate);
    }
  }
}

export function activateMarker(marker: AreaItemMarker) {
  state.activeMarker = ref(marker);
  const underground = marker?.marker.getUnderground();
  if (underground) {
    for (const item of store.mapData.getUndergroundMapList()) {
      const active = item.getChildList().find((i) => i.getId() == underground);
      if (active) {
        state.activeUndergroundMap = ref(active);
        break;
      }
    }
  } else {
    state.activeUndergroundMap = null;
  }
}

export function mark(marker: Marker) {
  state.marked.add(marker.getId());
  localStorage.setItem("marked", JSON.stringify([...state.marked]));
}

export function unmark(marker: Marker) {
  state.marked.delete(marker.getId());
  localStorage.setItem("marked", JSON.stringify([...state.marked]));
}

export function exportData() {
  const blob = new Blob([JSON.stringify([...state.marked])]);
  const link = document.createElement("a");
  link.style.display = "none";
  link.href = URL.createObjectURL(blob);
  link.download = `${new Date().toLocaleString()}.json`;
  link.click();
}

export function importData() {
  const input = document.createElement("input");
  input.style.display = "none";
  input.type = "file";
  input.click();
  input.onchange = ({ target }) => {
    const { files } = target as HTMLInputElement;
    if (files && files.length > 0) {
      const reader = new FileReader();
      reader.onload = () => {
        const data = JSON.parse(reader.result as string);
        if (state.marked.size > 0 && !confirm("是否覆盖当前数据")) {
          return;
        }
        state.marked = proxySet(data);
        localStorage.setItem("marked", JSON.stringify([...state.marked]));
      };
      reader.readAsText(files[0]);
    }
  };
}

// 设置选中的路径索引
export function setSelectedPathIndex(index: number) {
  state.developerMode.selectedPathIndex = index;
}

// 切换动画状态
export function toggleAnimation() {
  state.developerMode.isAnimating = !state.developerMode.isAnimating;
}

// 设置动画速度
export function setAnimationSpeed(speed: number) {
  state.developerMode.animationSpeed = speed;
}

async function init() {
  const marked = localStorage.getItem("marked");
  if (marked) {
    state.marked = proxySet(JSON.parse(marked));
  }
}

init();
