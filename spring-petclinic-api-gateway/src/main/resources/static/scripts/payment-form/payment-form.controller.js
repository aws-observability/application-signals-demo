"use strict";

angular.module("paymentForm").controller("paymentFormController", [
  "$http",
  "$state",
  "$stateParams",
  "$filter",
  function ($http, $state, $stateParams, $filter) {
    let self = this;
    let petId = $stateParams.petId || 0;
    let ownerId = $stateParams.ownerId || 0;
    let paymentId = $stateParams.paymentId || undefined;

    if (paymentId !== undefined) {
      let url = `api/payments/owners/${ownerId}/pets/${petId}/${paymentId}`;
      $http.get(url).then(function (resp) {
        self.amount = resp.data.amount;
        self.notes = resp.data.notes;
      });
      self.benLabel = "Update";
    } else {
      self.amount = "";
      self.notes = "";
      self.benLabel = "Add New";
    }

    self.submit = function () {
      let url = `api/payments/owners/${ownerId}/pets/${petId}`;
      let data = {};
      if (paymentId !== undefined) {
        data = {
          amount: self.amount,
          notes: self.notes,
          id: paymentId,
        };
      } else {
        data = {
          amount: self.amount,
          notes: self.notes,
          id: null,
        };
      }

      $http.post(url, data).then(function () {
        $state.go("petEdit", { ownerId: ownerId, petId: petId });
      });
    };
  },
]);
