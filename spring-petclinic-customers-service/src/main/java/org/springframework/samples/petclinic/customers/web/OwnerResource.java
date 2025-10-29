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
import io.opentelemetry.api.trace.Span;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Example;
import org.springframework.data.domain.ExampleMatcher;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.samples.petclinic.customers.Util.WellKnownAttributes;
import org.springframework.samples.petclinic.customers.model.Owner;
import org.springframework.samples.petclinic.customers.model.OwnerRepository;
import org.springframework.samples.petclinic.customers.model.Pet;
import org.springframework.samples.petclinic.customers.model.PetRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import javax.validation.Valid;
import javax.validation.constraints.Min;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

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
        Span.current().setAttribute(WellKnownAttributes.OWNER_ID, UUID.randomUUID().toString());
        Span.current().setAttribute(WellKnownAttributes.ORDER_ID, UUID.randomUUID().toString());

        // don't save the owner for testing traffic
        if (owner.getFirstName().equals("random-traffic")) {
            return owner;
        }
        
        try {
            return ownerRepository.save(owner);
        } catch (Exception e) {
            log.error("Failed to create owner: {}", owner, e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create owner", e);
        }
    }

    /**
     * Read single Owner
     */
    @GetMapping(value = "/{ownerId}")
    public Optional<Owner> findOwner(@PathVariable("ownerId") int ownerId) {
        Span.current().setAttribute(WellKnownAttributes.OWNER_ID, ownerId);
        Span.current().setAttribute(WellKnownAttributes.ORDER_ID, ownerId);

        if (ownerId < 1) {
            log.error("Invalid owner id provided: {}", ownerId);
            String reason = "Invalid user identifier " + ownerId + ": must be a positive number.";
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, reason);
        }
        
        try {
            return ownerRepository.findById(ownerId);
        } catch (Exception e) {
            log.error("Failed to find owner with id: {}", ownerId, e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to retrieve owner", e);
        }
    }

    /**
     * Read List of Owners
     */
    @GetMapping
    public List<Owner> findAll() {
        try {
            return ownerRepository.findAll();
        } catch (Exception e) {
            log.error("Failed to retrieve all owners", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to retrieve owners", e);
        }
    }

    /**
     * Update Owner
     */
    @PutMapping(value = "/{ownerId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void updateOwner(@PathVariable("ownerId") @Min(1) int ownerId, @Valid @RequestBody Owner ownerRequest) {
        Span.current().setAttribute(WellKnownAttributes.OWNER_ID, ownerId);
        Span.current().setAttribute(WellKnownAttributes.ORDER_ID, UUID.randomUUID().toString());

        try {
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
        } catch (ResourceNotFoundException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to update owner with id: {}", ownerId, e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to update owner", e);
        }
    }

    @Scheduled(cron = "0 0 8 * * ?") // every PST midnight
    @Transactional
    public void ageOldData() {
        log.info("ageOldData() called - starting data purge process");

        try {
            // FIXED: Use safer deletion approach to prevent StackOverflowError
            // Process in smaller batches to avoid memory issues and recursive problems
            
            /* Purge pets in batches to prevent StackOverflowError */
            Pet petExample = new Pet();
            petExample.setName("lastName");

            Example<Pet> petExampleQuery = Example.of(
                    petExample,
                    ExampleMatcher
                            .matchingAll()
                            .withStringMatcher(ExampleMatcher.StringMatcher.STARTING));

            // Process in smaller batches to prevent memory issues
            Pageable petPageable = PageRequest.of(0, 100); // Process 100 at a time
            List<Pet> pets = petRepository.findAll(petExampleQuery, petPageable).getContent();
            
            int totalPetsPurged = 0;
            while (!pets.isEmpty()) {
                log.info("Found {} pets to purge in this batch", pets.size());
                
                // Use individual delete operations instead of deleteAllInBatch to prevent StackOverflowError
                for (Pet pet : pets) {
                    try {
                        petRepository.delete(pet);
                        totalPetsPurged++;
                    } catch (Exception e) {
                        log.warn("Failed to delete pet with id: {}", pet.getId(), e);
                    }
                }
                
                // Get next batch
                pets = petRepository.findAll(petExampleQuery, petPageable).getContent();
                
                // Safety check to prevent infinite loops
                if (totalPetsPurged > 10000) {
                    log.warn("Stopping pet purge after {} deletions to prevent excessive processing", totalPetsPurged);
                    break;
                }
            }

            log.info("Successfully purged {} pets", totalPetsPurged);

            /* Purge owners in batches to prevent StackOverflowError */
            Owner ownerExample = new Owner();
            ownerExample.setFirstName("firstName");

            Example<Owner> ownerExampleQuery = Example.of(
                    ownerExample,
                    ExampleMatcher
                            .matchingAll()
                            .withStringMatcher(ExampleMatcher.StringMatcher.STARTING));

            // Process in smaller batches to prevent memory issues
            Pageable ownerPageable = PageRequest.of(0, 100); // Process 100 at a time
            List<Owner> owners = ownerRepository.findAll(ownerExampleQuery, ownerPageable).getContent();
            
            int totalOwnersPurged = 0;
            while (!owners.isEmpty()) {
                log.info("Found {} owners to purge in this batch", owners.size());
                
                // Use individual delete operations instead of deleteAllInBatch to prevent StackOverflowError
                for (Owner owner : owners) {
                    try {
                        ownerRepository.delete(owner);
                        totalOwnersPurged++;
                    } catch (Exception e) {
                        log.warn("Failed to delete owner with id: {}", owner.getId(), e);
                    }
                }
                
                // Get next batch
                owners = ownerRepository.findAll(ownerExampleQuery, ownerPageable).getContent();
                
                // Safety check to prevent infinite loops
                if (totalOwnersPurged > 10000) {
                    log.warn("Stopping owner purge after {} deletions to prevent excessive processing", totalOwnersPurged);
                    break;
                }
            }

            log.info("Successfully purged {} owners", totalOwnersPurged);
            log.info("Data purge process completed successfully");
            
        } catch (Exception e) {
            log.error("Error during data purge process", e);
            // Don't rethrow to prevent scheduled job from failing completely
        }
    }
}