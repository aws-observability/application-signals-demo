package org.springframework.samples.petclinic.api.dto;

import lombok.Data;

@Data
public class
PetInsurance {

    private Integer id;

    private Integer pet_id;

    private Integer owner_id;

    private Integer insurance_id;

    private String insurance_name;

    private Float price;
}
