package org.springframework.samples.petclinic.api.dto;

import lombok.Data;

@Data
public class PaymentAdd {

    private Double amount;

    private String notes;
}
