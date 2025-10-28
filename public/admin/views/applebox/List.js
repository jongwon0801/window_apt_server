"use strict";

angular
  .module("inspinia")
  .controller(
    "AppleboxListCtrl",
    function ($rootScope, $scope, $http, $window, $state) {
      // -----------------------------
      // 인증 체크
      // -----------------------------
      const stored = $window.localStorage.getItem("globals");
      if (!stored) return $state.go("login");

      $rootScope.globals = angular.fromJson(stored);
      $scope.currentUser = $rootScope.globals.currentUser;
      if (!$scope.currentUser || !$scope.currentUser.token)
        return $state.go("login");

      $http.defaults.headers.common.Authorization =
        "Bearer " + $scope.currentUser.token;

      // -----------------------------
      // 데이터 초기화
      // -----------------------------
      $scope.list = [];
      $scope.filteredList = [];
      $scope.pagedList = [];
      $scope.keyword = "";

      $scope.currentPage = 1;
      $scope.pageSize = 10;
      $scope.totalPages = 1;

      // -----------------------------
      // 데이터 로드
      // -----------------------------
      $scope.loadList = function () {
        $http
          .get("/api/applebox/appleboxCrud", { params: { display: 9999 } })
          .then(function (res) {
            $scope.list = res.data.data || [];
            $scope.filterList(); // 필터 적용 + 페이지네이션 갱신
          })
          .catch(function (err) {
            console.error("리스트 조회 오류:", err);
            toastr.error("리스트 조회 실패");
          });
      };

      // -----------------------------
      // 검색 / 필터
      // -----------------------------
      $scope.filterList = function () {
        const keyword = ($scope.keyword || "").toLowerCase();

        // filteredList 갱신
        $scope.filteredList = $scope.list.filter((item) => {
          if (!keyword) return true;
          return (
            (item.location && item.location.toLowerCase().includes(keyword)) ||
            (item.yid && String(item.yid).toLowerCase().includes(keyword))
          );
        });

        // 페이지 초기화
        $scope.currentPage = 1;
        $scope.totalPages =
          Math.ceil($scope.filteredList.length / $scope.pageSize) || 1;

        // pagedList 갱신
        $scope.updatePage();
      };

      // 현재 페이지 데이터만 보여주기
      $scope.updatePage = function () {
        const start = ($scope.currentPage - 1) * $scope.pageSize;
        const end = start + $scope.pageSize;
        $scope.pagedList = $scope.filteredList.slice(start, end);
      };

      // -----------------------------
      // 페이지 이동
      // -----------------------------
      $scope.goPage = function (page) {
        if (page < 1) page = 1;
        if (page > $scope.totalPages) page = $scope.totalPages;
        $scope.currentPage = page;
        $scope.updatePage();
      };

      // -----------------------------
      // 관제 버튼
      // -----------------------------
      $scope.camera = function (item) {
        toastr.info("관제 페이지 이동: " + item.location);
      };

      // -----------------------------
      // 초기 로드
      // -----------------------------
      $scope.loadList();
    }
  );
