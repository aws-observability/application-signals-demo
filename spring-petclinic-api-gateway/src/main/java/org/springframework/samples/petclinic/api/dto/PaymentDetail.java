package org.springframework.samples.petclinic.api.dto;

import java.util.Date;
import lombok.Data;

import com.fasterxml.jackson.annotation.JsonFormat;

@Data
public class PaymentDetail {

    private String id;

    private int petId;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date paymentDate;

    private Double amount;
}
