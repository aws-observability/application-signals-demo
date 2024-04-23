'use strict';

angular.module('petForm')
    .controller('PetFormController', ['$http', '$state', '$stateParams', function ($http, $state, $stateParams) {
        var self = this;
        var ownerId = $stateParams.ownerId || 0;

        $http.get('api/customer/petTypes').then(function (resp) {
            self.types = resp.data;
        }).then(function (){
            $http.get('api/insurance/insurances').then(function (resp) {
                self.insurances = resp.data;
                self.insuranceMap = {};
                for(let i = 0; i < self.insurances.length; i++){
                    self.insurances[i].id = "" + self.insurances[i].id
                    self.insuranceMap[self.insurances[i].id] = self.insurances[i];
                }
            }).then(function () {

                var petId = $stateParams.petId || 0;

                if (petId) { // edit
                    $http.get("api/customer/owners/" + ownerId + "/pets/" + petId).then(function (resp) {
                        self.pet = resp.data;
                        self.pet.birthDate = new Date(self.pet.birthDate);
                        self.petTypeId = "" + self.pet.type.id;
                    }).then(function () {
                        $http.get('api/insurance/pet-insurances/' + petId + '/').then(function (resp) {
                            var insurance = resp.data
                            self.pet.insurance_id = "" + insurance.insurance_id;
                            self.pet.insurance_name = insurance.insurance_name;
                            self.pet.price = insurance.price;
                            self.pet.insurance_contract_id = insurance.id;
                        });
                    });

                } else {
                    $http.get('api/customer/owners/' + ownerId).then(function (resp) {
                        self.pet = {
                            owner: resp.data.firstName + " " + resp.data.lastName
                        };
                        self.petTypeId = "1";
                    });
                }
            });
        })


        self.submit = function () {
            var id = self.pet.id || 0;

            var data = {
                id: id,
                name: self.pet.name,
                birthDate: self.pet.birthDate,
                typeId: self.petTypeId,
            };

            var req;
            if (id) {
                req = $http.put("api/customer/owners/" + ownerId + "/pets/" + id, data);
            } else {
                req = $http.post("api/customer/owners/" + ownerId + "/pets", data);
            }

            req.then(function (response){
                console.log(response);
                if(self.pet.insurance_contract_id){
                    $http.put("api/insurance/pet-insurances/" + self.pet.id, {
                        "pet_id": self.pet.id,
                        "owner_id": ownerId,
                        "insurance_id": self.pet.insurance_id,
                        "insurance_name": self.insuranceMap[self.pet.insurance_id + ""].name,
                        "price": self.insuranceMap[self.pet.insurance_id + ""].price
                    }).
                    then(function () {
                        $state.go('ownerDetails', {ownerId: ownerId});
                    });
                }
                else {
                    $http.post("api/insurance/pet-insurances/", {
                        "pet_id": response.data.id,
                        "owner_id": ownerId,
                        "insurance_id": self.pet.insurance_id,
                        "insurance_name": self.insuranceMap[self.pet.insurance_id + ""].name,
                        "price": self.insuranceMap[self.pet.insurance_id + ""].price
                    }).
                    then(function () {
                        $state.go('ownerDetails', {ownerId: ownerId});
                    });
                }

            })
        };
    }]);
