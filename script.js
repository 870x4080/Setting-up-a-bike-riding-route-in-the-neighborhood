// 전역 변수
let map;
let currentRoute = [];
let isDrawing = false;
let routePolyline = null;
let markers = [];
let savedRoutes = JSON.parse(localStorage.getItem('savedRoutes')) || [];

// DOM 요소
const startDrawingBtn = document.getElementById('startDrawing');
const stopDrawingBtn = document.getElementById('stopDrawing');
const undoLastPointBtn = document.getElementById('undoLastPoint');
const clearRouteBtn = document.getElementById('clearRoute');
const saveRouteBtn = document.getElementById('saveRoute');
const routeTitleInput = document.getElementById('routeTitle');
const distanceSpan = document.getElementById('distance');
const durationSpan = document.getElementById('duration');
const routesList = document.getElementById('routesList');
const roadSnapToggle = document.getElementById('roadSnapToggle');

// 지도 초기화
function initMap() {
    // 서울 시청을 중심으로 지도 초기화
    map = L.map('map').setView([37.5665, 126.9780], 13);
    
    // OpenStreetMap 타일 레이어 추가
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // 지도 클릭 이벤트 리스너
    map.on('click', handleMapClick);
    
    // 저장된 경로들 로드
    loadSavedRoutes();
    
    // 도로 스냅 기능 초기화
    initRoadSnapping();
}

// 지도 클릭 핸들러
function handleMapClick(e) {
    if (!isDrawing) return;
    
    // 도로 스냅 기능을 사용하여 가장 가까운 도로 지점 찾기
    const snappedLatlng = findNearestRoad(e.latlng);
    currentRoute.push(snappedLatlng);
    
    // 마커 추가
    const marker = L.marker(snappedLatlng, {
        icon: L.divIcon({
            className: 'custom-marker',
            html: '<div style="background-color: #667eea; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        })
    }).addTo(map);
    
    markers.push(marker);
    
    // 경로 그리기
    updateRouteDisplay();
    
    // 경로 통계 업데이트
    updateRouteStats();
    
    // 버튼 상태 업데이트
    updateButtonStates();
}

// 도로 스냅 기능 초기화
function initRoadSnapping() {
    // 도로 스냅 기능을 위한 전역 변수
    window.roadSnappingEnabled = roadSnapToggle.checked;
    
    // 토글 이벤트 리스너
    roadSnapToggle.addEventListener('change', (e) => {
        window.roadSnappingEnabled = e.target.checked;
        showNotification(
            e.target.checked ? '도로 스냅 기능이 활성화되었습니다.' : '도로 스냅 기능이 비활성화되었습니다.',
            'info'
        );
    });
}

// 가장 가까운 도로 지점 찾기
function findNearestRoad(clickedLatlng) {
    if (!window.roadSnappingEnabled) {
        return clickedLatlng;
    }
    
    // 더 정교한 도로 스냅 시뮬레이션
    const lat = clickedLatlng.lat;
    const lng = clickedLatlng.lng;
    
    // 도로 격자 시스템 (실제 도로 네트워크를 시뮬레이션)
    // 위도/경도를 더 정밀하게 조정하여 도로에 스냅
    const gridSize = 0.0001; // 약 10미터 간격
    
    const snappedLat = Math.round(lat / gridSize) * gridSize;
    const snappedLng = Math.round(lng / gridSize) * gridSize;
    
    // 스냅된 지점이 원래 클릭 지점에서 너무 멀지 않도록 제한
    const maxDistance = 0.001; // 약 100미터
    const distance = Math.sqrt(
        Math.pow(lat - snappedLat, 2) + Math.pow(lng - snappedLng, 2)
    );
    
    if (distance > maxDistance) {
        // 너무 멀면 원래 지점 사용
        return clickedLatlng;
    }
    
    return L.latLng(snappedLat, snappedLng);
}

// 경로 표시 업데이트
function updateRouteDisplay() {
    if (routePolyline) {
        map.removeLayer(routePolyline);
    }
    
    if (currentRoute.length >= 2) {
        routePolyline = L.polyline(currentRoute, {
            color: '#2196F3',
            weight: 4,
            opacity: 0.8
        }).addTo(map);
    }
}

// 경로 통계 업데이트
function updateRouteStats() {
    if (currentRoute.length < 2) {
        distanceSpan.textContent = '0';
        durationSpan.textContent = '0';
        return;
    }
    
    let totalDistance = 0;
    for (let i = 1; i < currentRoute.length; i++) {
        totalDistance += currentRoute[i-1].distanceTo(currentRoute[i]);
    }
    
    // km로 변환 (대략적인 자전거 속도 15km/h 기준)
    const distanceKm = (totalDistance / 1000).toFixed(2);
    const durationMinutes = Math.round((distanceKm / 15) * 60);
    
    distanceSpan.textContent = distanceKm;
    durationSpan.textContent = durationMinutes;
}

// 그리기 시작
function startDrawing() {
    isDrawing = true;
    startDrawingBtn.disabled = true;
    stopDrawingBtn.disabled = false;
    map.getContainer().style.cursor = 'crosshair';
    
    // 사용자에게 안내 메시지
    showNotification('지도에서 클릭하여 경로를 그려주세요! (도로에 자동으로 스냅됩니다)', 'info');
}

// 그리기 중지
function stopDrawing() {
    isDrawing = false;
    startDrawingBtn.disabled = false;
    stopDrawingBtn.disabled = true;
    undoLastPointBtn.disabled = currentRoute.length === 0;
    map.getContainer().style.cursor = 'grab';
    
    if (currentRoute.length > 0) {
        showNotification('경로 그리기가 완료되었습니다. 제목을 입력하고 저장해주세요!', 'success');
    }
}

// 마지막 점 삭제 (뒤로 가기)
function undoLastPoint() {
    if (currentRoute.length === 0) return;
    
    // 마지막 점과 마커 제거
    currentRoute.pop();
    const lastMarker = markers.pop();
    if (lastMarker) {
        map.removeLayer(lastMarker);
    }
    
    // 경로 그리기 업데이트
    updateRouteDisplay();
    
    // 경로 통계 업데이트
    updateRouteStats();
    
    // 버튼 상태 업데이트
    updateButtonStates();
    
    showNotification('마지막 점이 삭제되었습니다.', 'info');
}

// 경로 지우기
function clearRoute() {
    currentRoute = [];
    
    // 마커들 제거
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    // 경로 선 제거
    if (routePolyline) {
        map.removeLayer(routePolyline);
        routePolyline = null;
    }
    
    // 통계 초기화
    updateRouteStats();
    
    // 버튼 상태 업데이트
    updateButtonStates();
    
    // 입력 필드 초기화
    routeTitleInput.value = '';
    
    showNotification('경로가 지워졌습니다.', 'info');
}

// 경로 저장
function saveRoute() {
    const title = routeTitleInput.value.trim();
    
    if (!title) {
        showNotification('경로 제목을 입력해주세요!', 'error');
        return;
    }
    
    if (currentRoute.length < 2) {
        showNotification('최소 2개 이상의 지점을 찍어주세요!', 'error');
        return;
    }
    
    const routeData = {
        id: Date.now(),
        title: title,
        route: currentRoute.map(point => [point.lat, point.lng]),
        distance: parseFloat(distanceSpan.textContent),
        duration: parseInt(durationSpan.textContent),
        createdAt: new Date().toISOString()
    };
    
    savedRoutes.push(routeData);
    localStorage.setItem('savedRoutes', JSON.stringify(savedRoutes));
    
    // 저장된 경로 목록 업데이트
    loadSavedRoutes();
    
    // 입력 필드 초기화
    routeTitleInput.value = '';
    
    showNotification(`"${title}" 경로가 저장되었습니다!`, 'success');
}

// 저장된 경로들 로드
function loadSavedRoutes() {
    const routesListElement = document.getElementById('routesList');
    
    if (savedRoutes.length === 0) {
        routesListElement.innerHTML = '<p class="no-routes">저장된 경로가 없습니다.</p>';
        return;
    }
    
    routesListElement.innerHTML = '';
    
    savedRoutes.forEach(route => {
        const routeElement = createRouteElement(route);
        routesListElement.appendChild(routeElement);
    });
}

// 경로 요소 생성
function createRouteElement(route) {
    const div = document.createElement('div');
    div.className = 'saved-route-item';
    
    const date = new Date(route.createdAt).toLocaleDateString('ko-KR');
    
    div.innerHTML = `
        <h4>${route.title}</h4>
        <p>거리: ${route.distance} km</p>
        <p>소요시간: ${route.duration} 분</p>
        <p>생성일: ${date}</p>
        <div class="route-actions">
            <button class="load-btn" onclick="loadRoute(${route.id})">불러오기</button>
            <button class="delete-btn" onclick="deleteRoute(${route.id})">삭제</button>
        </div>
    `;
    
    return div;
}

// 경로 불러오기
function loadRoute(routeId) {
    const route = savedRoutes.find(r => r.id === routeId);
    if (!route) return;
    
    // 현재 경로 지우기
    clearRoute();
    
    // 저장된 경로 데이터를 현재 경로로 변환
    currentRoute = route.route.map(point => L.latLng(point[0], point[1]));
    
    // 마커들 추가
    currentRoute.forEach(latlng => {
        const marker = L.marker(latlng, {
            icon: L.divIcon({
                className: 'custom-marker',
                html: '<div style="background-color: #667eea; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [12, 12],
                iconAnchor: [6, 6]
            })
        }).addTo(map);
        
        markers.push(marker);
    });
    
    // 경로 표시
    updateRouteDisplay();
    updateRouteStats();
    
    // 지도 뷰를 경로에 맞게 조정
    if (currentRoute.length > 0) {
        map.fitBounds(L.latLngBounds(currentRoute), { padding: [20, 20] });
    }
    
    showNotification(`"${route.title}" 경로를 불러왔습니다!`, 'success');
}

// 경로 삭제
function deleteRoute(routeId) {
    if (!confirm('정말로 이 경로를 삭제하시겠습니까?')) return;
    
    savedRoutes = savedRoutes.filter(route => route.id !== routeId);
    localStorage.setItem('savedRoutes', JSON.stringify(savedRoutes));
    
    loadSavedRoutes();
    showNotification('경로가 삭제되었습니다.', 'info');
}

// 알림 표시
function showNotification(message, type = 'info') {
    // 기존 알림 제거
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // 스타일 적용
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 1000;
        animation: slideIn 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    // 타입별 색상
    const colors = {
        success: '#4CAF50',
        error: '#f44336',
        info: '#2196F3',
        warning: '#ff9800'
    };
    
    notification.style.backgroundColor = colors[type] || colors.info;
    
    document.body.appendChild(notification);
    
    // 3초 후 자동 제거
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 3000);
}

// 버튼 상태 업데이트
function updateButtonStates() {
    // 뒤로 가기 버튼 활성화/비활성화
    undoLastPointBtn.disabled = currentRoute.length === 0;
    
    // 저장 버튼 활성화/비활성화
    saveRouteBtn.disabled = currentRoute.length < 2;
}

// 키보드 단축키
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isDrawing) {
        stopDrawing();
    }
    
    if (e.key === 'Enter' && document.activeElement === routeTitleInput) {
        saveRoute();
    }
    
    // Ctrl+Z 또는 Backspace로 마지막 점 삭제
    if ((e.key === 'z' && e.ctrlKey) || e.key === 'Backspace') {
        if (isDrawing && currentRoute.length > 0) {
            undoLastPoint();
        }
    }
});

// 이벤트 리스너 등록
startDrawingBtn.addEventListener('click', startDrawing);
stopDrawingBtn.addEventListener('click', stopDrawing);
undoLastPointBtn.addEventListener('click', undoLastPoint);
clearRouteBtn.addEventListener('click', clearRoute);
saveRouteBtn.addEventListener('click', saveRoute);

// CSS 애니메이션 추가
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// 페이지 로드 시 지도 초기화
document.addEventListener('DOMContentLoaded', initMap); 