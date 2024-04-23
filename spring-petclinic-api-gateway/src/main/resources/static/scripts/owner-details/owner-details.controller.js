'use strict';

angular.module('ownerDetails')
    .controller('OwnerDetailsController', ['$http', '$stateParams', function ($http, $stateParams) {
        var self = this;
        var timeout = 0;
        let promiseDone = [];
        $http.get('api/gateway/owners/' + $stateParams.ownerId).then(function (resp) {
            self.owner = resp.data;
            for(let i = 0; i < self.owner.pets.length; i ++){
                promiseDone.push({
                    "done": false
                })
            }

        }).then(function (){

            for(let i = 0; i < self.owner.pets.length; i ++){
                let pet = self.owner.pets[i];
                $http.get('api/insurance/pet-insurances/' + pet.id + '/').then(function (response){
                    promiseDone[i] = true;
                    self.owner.pets[i].insurance_name = response.data.insurance_name;
                }).catch(function (err) {
                    self.owner.pets[i].insurance_name = "";
                });
            }
        }).then(function(){
            wait(promiseDone);
        });
        function isPromiseDone(promiseDone){
            for (let i = 0; i < promiseDone.length; i ++){
                if (promiseDone[i]['done'] === false){
                    return false;
                }
            }
            return true;
        }
        function wait(promiseDone) {
            if(!isPromiseDone(promiseDone)){
                timeout ++;
                if ( timeout > 2) {
                    return;
                }
                setTimeout(function() {
                    wait(promiseDone)
                }, 500);
            }
        }
    }]);
