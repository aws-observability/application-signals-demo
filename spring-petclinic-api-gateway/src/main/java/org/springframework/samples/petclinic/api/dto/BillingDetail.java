package org.springframework.samples.petclinic.api.dto;
import lombok.Data;

@Data
public class BillingDetail {

    private int id;

    private int owner_id;

    private String first_name;

    private String last_name;

    private String type;

    private String type_name;

    private int pet_id;

    private Float payment;

    private String status;

}
