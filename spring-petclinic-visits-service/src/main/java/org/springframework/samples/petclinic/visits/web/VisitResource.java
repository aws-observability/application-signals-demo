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
package org.springframework.samples.petclinic.visits.web;

import java.util.Date;
import java.util.List;
import java.util.UUID;
import javax.validation.Valid;
import javax.validation.constraints.Min;

import io.micrometer.core.annotation.Timed;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import lombok.RequiredArgsConstructor;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.samples.petclinic.visits.Util.WellKnownAttributes;
import org.springframework.samples.petclinic.visits.aws.DdbService;
import org.springframework.samples.petclinic.visits.model.Visit;
import org.springframework.samples.petclinic.visits.model.VisitRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.ExceptionHandler;

/**
 * @author Juergen Hoeller
 * @author Ken Krebs
 * @author Arjen Poutsma
 * @author Michael Isvy
 * @author Maciej Szarlinski
 * @author Ramazan Sakin
 */
@RestController
@RequiredArgsConstructor
@Slf4j
@Timed("petclinic.visit")
class VisitResource {

    private final VisitRepository visitRepository;

    private final DdbService ddbService;


    @PostMapping("owners/{ownerId}/pets/{petId}/visits")
    @ResponseStatus(HttpStatus.CREATED)
    public Visit create(
        @Valid @RequestBody Visit visit,
        @PathVariable("ownerId") int ownerId,
        @PathVariable("petId") @Min(1) int petId) {
        Span.current().setAttribute(WellKnownAttributes.ORDER_ID, UUID.randomUUID().toString());
        Span.current().setAttribute(WellKnownAttributes.OWNER_ID, ownerId);
        Span.current().setAttribute(WellKnownAttributes.PET_ID, petId);

        log.info("Reaching Post api: owners/*/pets/{petId}/visits for petId: {}", petId);
        validateDate(visit);
        return saveVisit(visit, petId);
    }

    @WithSpan("validateDate")
    private void validateDate(Visit visit) {
        Date currentDate = new Date();
        Date visitDate = visit.getDate();
        long durationInDays = (visitDate.getTime() - currentDate.getTime())/1000/3600/24;
        log.info("New visit date is {} days from today", durationInDays);
        if (durationInDays > 30) {
            String message = "Visit cannot be scheduled for a date more than 30 days in the future.";
            InvalidDateException exception = new InvalidDateException(message);

            // Record the exception in the current span
            Span currentSpan = Span.current();
            currentSpan.recordException(exception);
            currentSpan.setStatus(StatusCode.ERROR, message);

            throw exception;
        }
    }

    @WithSpan("saveVisit")
    private Visit saveVisit(Visit visit, int petId) {
        ddbService.putItems();
        visit.setPetId(petId);
        // petId 9 is used for testing high traffic
        // To avoid overwhelming visitRepository, we don't want to save the visit.
        if (petId == 9) {
            log.info("Testing random traffic with visit {}", visit);
            return visit;
        }
        log.info("Saving visit {}", visit);
        return visitRepository.save(visit);
    }

    @GetMapping("owners/{ownerId}/pets/{petId}/visits")
    public Visits visits(@PathVariable("ownerId") int ownerId, @PathVariable("petId") @Min(1) int petId) throws Exception {
        Span.current().setAttribute(WellKnownAttributes.OWNER_ID, ownerId);
        Span.current().setAttribute(WellKnownAttributes.PET_ID, petId);
        Span.current().setAttribute(WellKnownAttributes.ORDER_ID, petId);

//        return visitRepository.findByPetId(petId);
        log.info("Reaching Get api: /owners/*/pets/{petId}/visits for petId: {}", petId);
        return new Visits(visitRepository.findByPetId(petId));
    }

    @ExceptionHandler(InvalidDateException.class)
    public ResponseEntity<String> handleInvalidDateException(InvalidDateException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
    }

    @GetMapping("pets/visits")
    public Visits visitsMultiGet(@RequestParam("petId") List<Integer> petIds) throws Exception {
        final List<Visit> byPetIdIn = visitRepository.findByPetIdIn(petIds);
        log.info("Reaching Get api: pets/visits for petIds: {}", petIds);
        return new Visits(byPetIdIn);
    }

    @Scheduled(cron = "0 0 8 * * ?") // every PST midnight
    public void ageOldData() {
        log.info("ageOldData() get called and purge all data!");
        visitRepository.deleteAll();
    }

    @Value
    static class Visits {
        List<Visit> items;
    }
}
