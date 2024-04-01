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
 */
package org.springframework.samples.petclinic.customers.web;

import java.util.Date;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;
import org.springframework.core.style.ToStringCreator;

@Data
public class PetInsurance{
    private Integer id;
    private Integer pet_id;
    private String insurance_name;
    private Integer insurance_id;
    private Float price;
    @Override
    public String toString() {
        return new ToStringCreator(this)
                .append("id", this.getId())
                .append("pet_id", this.getPet_id())
                .append("insurance", this.getInsurance_name())
                .append("insurance_id", this.getInsurance_id())
                .append("price", this.getPrice())
                .toString();
    }
}