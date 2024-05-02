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
import org.springframework.data.domain.Example;
import org.springframework.data.domain.ExampleMatcher;
import org.springframework.http.HttpStatus;
import org.springframework.samples.petclinic.customers.model.Owner;
import org.springframework.samples.petclinic.customers.model.OwnerRepository;
import org.springframework.samples.petclinic.customers.model.Pet;
import org.springframework.samples.petclinic.customers.model.PetRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import javax.validation.Valid;
import javax.validation.constraints.Min;
import java.util.List;
import java.util.Optional;

/**
 * @author Juergen Hoeller
 * @author Ken Krebs
 * @author Arjen Poutsma
 * @author Michael Isvy
 * @author Maciej Szarlinski
 */
@RequestMapping("/owners")
@RestController
@Timed("petclinic.owner")
@RequiredArgsConstructor
@Slf4j
class OwnerResource {

    private final OwnerRepository ownerRepository;
    private final PetRepository petRepository;

    /**
     * Create Owner
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Owner createOwner(@Valid @RequestBody Owner owner) throws Exception {
        // don't save the owner for testing traffic
        if (owner.getFirstName().equals("random-traffic")) {
            return owner;
        }
        return ownerRepository.save(owner);
    }

    /**
     * Read single Owner
     */
    @GetMapping(value = "/{ownerId}")
    public Optional<Owner> findOwner(@PathVariable("ownerId") int ownerId) {
        if (ownerId < 1) {
            log.error("Invalid owner id provided: {}", ownerId);
            String reason = "Invalid user identifier " + ownerId + ": must be a positive number.";
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, reason);
        }
        return ownerRepository.findById(ownerId);
    }

    /**
     * Read List of Owners
     */
    @GetMapping
    public List<Owner> findAll() {
        return ownerRepository.findAll();
    }

    /**
     * Update Owner
     */
    @PutMapping(value = "/{ownerId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateOwner(@PathVariable("ownerId") @Min(1) int ownerId, @Valid @RequestBody Owner ownerRequest) {
        final Optional<Owner> owner = ownerRepository.findById(ownerId);
        final Owner ownerModel = owner.orElseThrow(() -> new ResourceNotFoundException("Owner "+ownerId+" not found"));

        // This is done by hand for simplicity purpose. In a real life use-case we should consider using MapStruct.
        ownerModel.setFirstName(ownerRequest.getFirstName());
        ownerModel.setLastName(ownerRequest.getLastName());
        ownerModel.setCity(ownerRequest.getCity());
        ownerModel.setAddress(ownerRequest.getAddress());
        ownerModel.setTelephone(ownerRequest.getTelephone());
        log.info("Saving owner {}", ownerModel);
        ownerRepository.save(ownerModel);
    }

    @Scheduled(cron = "0 0 8 * * ?") // every PST midnight
    public void ageOldData() {
        log.info("ageOldData() get called and purge all data!");
        ownerRepository.deleteAll();
        /* Purge pets. */
        Pet pet = new Pet();
        pet.setName("lastName");

        Example<Pet> petExample = Example.of(
                pet,
                ExampleMatcher
                        .matchingAll()
                        .withStringMatcher(ExampleMatcher.StringMatcher.STARTING));

        List<Pet> pets = petRepository.findAll(petExample);
        log.info("Found {} pets to purge", pets.size());
        petRepository.deleteAllInBatch(pets);

        log.info("Successfully purged {} pets", pets.size());

        /* Purge owners. */
        Owner owner = new Owner();
        owner.setFirstName("firstName");

        Example<Owner> ownerExample = Example.of(
                owner,
                ExampleMatcher
                        .matchingAll()
                        .withStringMatcher(ExampleMatcher.StringMatcher.STARTING));

        List<Owner> owners = ownerRepository.findAll(ownerExample);
        log.info("Found {} owners to purge", owners.size());
        ownerRepository.deleteAllInBatch(owners);

        log.info("Successfully purged {} owners", owners.size());
    }
}
