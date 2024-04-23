package org.springframework.samples.petclinic.api.dto;
import lombok.Data;

@Data
public class InsuranceDetail {

    private int id;

    private String name;

    private String description;

    private float price;
}
