package com.kgd.fulfillment.presentation.fulfillment.dto

data class CreateFulfillmentRequest(val orderId: Long, val warehouseId: Long)
data class TransitionRequest(val targetStatus: String)
