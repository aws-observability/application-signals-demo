package org.springframework.samples.petclinic.api.dto;

import lombok.Data;

@Data
public class PaymentAdd {

    private String id;

    private Double amount;

    private String notes;
}
