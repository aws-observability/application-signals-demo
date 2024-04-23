/*
 * Copyright 2002-2021 the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Modifications Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package org.springframework.samples.petclinic.customers.web;

import io.micrometer.core.annotation.Timed;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.samples.petclinic.customers.aws.KinesisService;
import org.springframework.samples.petclinic.customers.aws.SqsService;
import org.springframework.samples.petclinic.customers.model.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import javax.validation.constraints.Min;
import java.util.List;
import java.util.Optional;

/**
 * @author Juergen Hoeller
 * @author Ken Krebs
 * @author Arjen Poutsma
 * @author Maciej Szarlinski
 * @author Ramazan Sakin
 */
@RestController
@Timed("petclinic.pet")
@RequiredArgsConstructor
@Slf4j
class PetResource {

    private final PetRepository petRepository;
    private final OwnerRepository ownerRepository;
    private final SqsService sqsService;
    private final KinesisService kinesisService;
    
    @Autowired
    private RestTemplate restTemplate;

    @GetMapping("/petTypes")
    public List<PetType> getPetTypes() {
        return petRepository.findPetTypes();
    }

    @PostMapping("/owners/{ownerId}/pets")
    @ResponseStatus(HttpStatus.CREATED)
    public Pet processCreationForm(
        @RequestBody PetRequest petRequest,
        @PathVariable("ownerId") @Min(1) int ownerId) {

        final Optional<Owner> optionalOwner = ownerRepository.findById(ownerId);
        Owner owner = optionalOwner.orElseThrow(() -> new ResourceNotFoundException("Owner "+ownerId+" not found"));

        sqsService.sendMsg();
        final Pet pet = new Pet();
        owner.addPet(pet);

        return save(pet, petRequest);
    }

    @PutMapping("/owners/*/pets/{petId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void processUpdateForm(@RequestBody PetRequest petRequest) {
        int petId = petRequest.getId();
        Pet pet = findPetById(petId);
        kinesisService.getStreamRecords();
        save(pet, petRequest);
    }

    private Pet save(final Pet pet, final PetRequest petRequest) {

        pet.setName(petRequest.getName());
        pet.setBirthDate(petRequest.getBirthDate());
        petRepository.findPetTypeById(petRequest.getTypeId())
            .ifPresent(pet::setType);

        log.info("Saving pet {}", pet);
        return petRepository.save(pet);
    }

    @GetMapping("owners/*/pets/{petId}")
    public PetDetails findPet(@PathVariable("petId") int petId) {
        PetDetails detail = new PetDetails(findPetById(petId));
        PetInsurance petInsurance = null;
        try{
            ResponseEntity<PetInsurance> response = restTemplate.getForEntity("http://insurance-service/pet-insurances/" + detail.getId(), PetInsurance.class);
            petInsurance = response.getBody();
        }
        catch (Exception ex){
            ex.printStackTrace();
        }
        if(petInsurance == null){
            System.out.println("empty petInsurance");
            return detail;
        }
        detail.setInsurance_id(petInsurance.getInsurance_id());
        detail.setInsurance_name(petInsurance.getInsurance_name());
        detail.setPrice(petInsurance.getPrice());
        return detail;
    }


    private Pet findPetById(int petId) {
        Optional<Pet> pet = petRepository.findById(petId);
        if (!pet.isPresent()) {
            throw new ResourceNotFoundException("Pet "+petId+" not found");
        }
        return pet.get();
    }

}
