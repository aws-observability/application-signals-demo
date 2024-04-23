package org.springframework.samples.petclinic.api.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class PetFull {
    private int id;

    private String name;

    private String birthDate;

    private PetType type;

    private Integer insurance_id;

    private String insurance_name;

    private Float price;

    private final List<VisitDetails> visits = new ArrayList<>();
}
