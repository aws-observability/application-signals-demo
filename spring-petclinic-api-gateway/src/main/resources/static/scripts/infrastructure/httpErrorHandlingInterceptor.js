'use strict';

/**
 * Global HTTP errors handler.
 */
angular.module('infrastructure')
    .factory('HttpErrorHandlingInterceptor', function () {
        return {
            responseError: function (response) {
                var error = response.data;
                if(error) {
                    var errorAlert = document.getElementById("http-error-alert");
                    var errorMessage = document.getElementById("http-error-message");
                    var errorDescription = error.message ? error.message : error.error;
                    errorAlert.removeAttribute("style");
                    errorMessage.innerHTML = `${error.status}: ${errorDescription}`;
                }
                return response;
            }
        }
    });