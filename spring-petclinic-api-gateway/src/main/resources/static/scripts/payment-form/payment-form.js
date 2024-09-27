"use strict";

angular.module("paymentForm", ["ui.router"]).config([
  "$stateProvider",
  function ($stateProvider) {
    $stateProvider.state("addPayment", {
      parent: "app",
      url: "/owners/:ownerId/pets/:petId/payments",
      template: "<payment-form></payment-form>",
    });
    $stateProvider.state("editPayment", {
      parent: "app",
      url: "/owners/:ownerId/pets/:petId/payments/:paymentId",
      template: "<payment-form></payment-form>",
    });
  },
]);
