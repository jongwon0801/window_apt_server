"use strict";

angular
  .module("inspinia")
  .controller("AppleboxViewCtrl", function ($scope, $http, $stateParams, $uibModal, $q) {
    $scope.yid = $stateParams.yid;
    $scope.lockers = [];
    $scope.lockerWidth = 100;
    $scope.lockerHeight = 100;

    // -----------------------------
    // 라즈베리 상태 → DB 동기화 후 락커 로드
    // -----------------------------
    $scope.loadLockers = function () {
      // 1️⃣ 라즈베리에서 실시간 상태 가져오기
      $http.get(`/v1/AppleboxAll/${$scope.yid}`)
        .then(res => {
          const raspberryData = res.data.data?.cabinet || [];

          // 2️⃣ 라즈베리 데이터 → DB 상태 업데이트
          const updatePromises = [];
          raspberryData.forEach(cab => {
            cab.box.forEach(box => {
              updatePromises.push(
                $http.post(`/api/locker/updateStatus/${box.serial}`, {
                  status: box.closed ? "A" : "B", // 예: 닫힘→A, 열림→B
                })
              );
            });
          });

          // 3️⃣ 모든 업데이트가 끝나면 DB에서 목록 다시 가져옴
          return $q.all(updatePromises);
        })
        .then(() => {
          return $http.get(`/api/locker/lockerCrud/${$scope.yid}`);
        })
        .then(res => {
          // 4️⃣ DB 기준으로 화면 표시
          $scope.lockers = res.data;
          calculateLockerPositions($scope.lockers);
        })
        .catch(err => {
          console.error("락커 불러오기 오류:", err);
          toastr.error("락커 정보를 불러오지 못했습니다.");
        });
    };

    // -----------------------------
    // 위치 계산 함수
    // -----------------------------
    function calculateLockerPositions(lockers) {
      const processed = [];
      const padding = 10;
      let maxCol = 0, maxRow = 0;
      lockers.forEach(l => {
        maxCol = Math.max(maxCol, l.col - 1);
        maxRow = Math.max(maxRow, Math.floor(l.row) - 1);
      });

      const grouped = {};
      lockers.forEach(l => {
        const key = `${l.col}-${Math.floor(l.row)}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(l);
      });

      const colWidths = Array(maxCol + 1).fill(0);
      const rowHeights = Array(maxRow + 1).fill(0);

      Object.keys(grouped).forEach(k => {
        const [col, row] = k.split("-").map(Number);
        const colIdx = col - 1;
        const rowIdx = row - 1;
        let widthSum = -padding;
        let maxH = 0;
        grouped[k].forEach(l => {
          widthSum += (l.width || $scope.lockerWidth) + padding;
          maxH = Math.max(maxH, l.height || $scope.lockerHeight);
        });
        colWidths[colIdx] = Math.max(colWidths[colIdx], widthSum);
        rowHeights[rowIdx] = Math.max(rowHeights[rowIdx], maxH);
      });

      const colPos = [0];
      const rowPos = [0];
      for (let i = 1; i <= maxCol; i++) colPos[i] = colPos[i - 1] + colWidths[i - 1] + padding;
      for (let i = 1; i <= maxRow; i++) rowPos[i] = rowPos[i - 1] + rowHeights[i - 1] + padding;

      Object.keys(grouped).forEach(k => {
        const group = grouped[k];
        const [col, row] = k.split("-").map(Number);
        const colIdx = col - 1;
        const rowIdx = row - 1;
        let offsetX = 0;
        group.forEach(l => {
          processed.push({
            ...l,
            label: l.label || `${String.fromCharCode(65 + colIdx)}${row}`,
            loc: {
              left: colPos[colIdx] + offsetX,
              top: rowPos[rowIdx],
            },
          });
          offsetX += (l.width || $scope.lockerWidth) + padding;
        });
      });

      $scope.lockers = processed;
    }

    // -----------------------------
    // 문 열기 모달
    // -----------------------------
    $scope.openLocker = function (locker) {
      const modalInstance = $uibModal.open({
        animation: true,
        template: `
          <div class="modal-header">
            <h4 class="modal-title">문 열기</h4>
          </div>
          <div class="modal-body">
            <p>락커 <strong>{{locker.label}}</strong>의 문을 여시겠습니까?</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" ng-click="cancel()">취소</button>
            <button class="btn btn-primary" ng-click="confirm()">열기</button>
          </div>
        `,
        controller: function ($scope, $uibModalInstance, $http, toastr) {
          $scope.locker = locker;

          $scope.cancel = function () {
            $uibModalInstance.dismiss("cancel");
          };

          $scope.confirm = function () {
            // 1️⃣ DB 상태 변경 (예: 열림)
            $http.post(`/api/locker/updateStatus/${locker.serial}`, { status: "B" })
              .then(() => {
                locker.status = "B";
                // 2️⃣ 라즈베리 제어 신호 전송
                return $http.post(`/v1/OpenLocker/${locker.serial}`, locker);
              })
              .then(() => {
                toastr.success(`${locker.label} 문을 열었습니다.`);
                $uibModalInstance.close();
              })
              .catch(() => {
                toastr.error("문 열기에 실패했습니다.");
              });
          };
        },
      });
    };

    // -----------------------------
    // 초기 실행
    // -----------------------------
    $scope.loadLockers();
  });
