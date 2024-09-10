'use strict';

angular.module('ownerDetails')
    .controller('OwnerDetailsController', ['$http', '$stateParams', function ($http, $stateParams) {
        var self = this;
        $http.get('api/gateway/owners/' + $stateParams.ownerId).then(function (resp) {
            self.owner = resp.data;
        }).then(function (){
            self.owner.pets.forEach(function(pet){
                $http.get('api/insurance/pet-insurances/' + pet.id + '/').then(function(res){
                    pet.insurance_name = res.data.insurance_name;
                }).catch(function (err) {
                    pet.insurance_name = "";
                });
                
                $http.get('api/nutrition/facts/' + pet.type.name + '/').then(function(res){
                    pet.nutritionFacts = res.data.facts;
                }).catch(function (err) {
                    pet.nutritionFacts = "";
                });
            });
        });
    }]);
