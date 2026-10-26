local Receipt = {}
-- Acknowledgement decisions are plain booleans; Roblox enum conversion is at the edge.
function Receipt.process(receipt, productId, online, ledger)
    if productId==0 or receipt.ProductId~=productId or not online(receipt.PlayerId) then return false end
    local record=ledger:grant(receipt.PlayerId,receipt.PurchaseId)
    return record~=nil
end
return Receipt
