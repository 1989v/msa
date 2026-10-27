local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local HttpService = game:GetService("HttpService")
local MarketplaceService = game:GetService("MarketplaceService")
local Shared = game.ReplicatedStorage.InfinityStep
local Rules = require(Shared.Rules)
local Store = require(script.Parent.Store)
local Action = Shared.Action
local surfaces = workspace.NativeWorld.Surfaces
for _, surface in surfaces:GetChildren() do
 local id = tonumber(string.match(surface.Name, "^Landing(%d+)$"))
 if id then surface:SetAttribute("LandingId", id) end
end
local sessions = {}
local function destination(id)
 return surfaces:FindFirstChild(string.format("Landing%02d", id))
end
local function place(character, id)
 local roof = destination(id)
 if roof and character and character.Parent then
  character:PivotTo(roof.CFrame + Vector3.new(0, roof.Size.Y / 2 + 4, 0))
  local root = character:FindFirstChild("HumanoidRootPart")
  if root then root.AssemblyLinearVelocity = Vector3.zero end
  return true
 end
 return false
end
local function publish(player, session)
 player:SetAttribute("CurrentRoof", session.current)
 player:SetAttribute("BestRoof", session.best or session.record.best)
 player:SetAttribute("Revives", session.record.credits)
 player:SetAttribute("ReviveTarget", session.offer or -1)
 player:SetAttribute("SaveReady", session.ready)
 player:SetAttribute("Completed", session.current == 42)
end
local function transaction(player, session, transform)
 if session.busy then return false end
 session.busy = true
 local ok, record = Store.update(player.UserId, function(value)
  if value.owner ~= session.token then return false end
  return transform(value)
 end)
 session.busy = false
 if ok then session.record = record end
 return ok
end
local function save(player, session, release)
 session.sequence += 1
 local sequence, current, best = session.sequence, session.safeCurrent or 0, session.best or 0
 return transaction(player, session, function(record)
  if not Rules.snapshot(record, session.token, sequence, current, os.time(), best) then return false end
  if release then record.owner, record.lease = "", 0 end
  return true
 end)
end
Players.PlayerAdded:Connect(function(player)
 local session = {token = HttpService:GenerateGUID(false), sequence = 0, current = 0, best = 0, safeCurrent = 0, fallDismissed = false, stable = 0, charge = 0, stamina = 1, offer = nil, busy = false, ready = false, lastAction = -math.huge, grounded = false, airJumpSeen = false, climbUntil = 0}
 sessions[player] = session
 player:SetAttribute("DevelopmentInventory", RunService:IsStudio())
 publish(player, {current = 0, record = Rules.newRecord(), offer = nil, ready = false})
 local function setup(character)
  local humanoid = character:WaitForChild("Humanoid")
  character:WaitForChild("HumanoidRootPart")
  humanoid.UseJumpPower = true
  humanoid.JumpPower = Rules.MIN_POWER
  humanoid.WalkSpeed = 16
  session.charge, session.stable, session.stamina = 0, 0, 1
  session.grounded, session.airJumpSeen, session.landingLatch = false, false, false
  -- No JumpRequest binding, no jump impulse, and no server-created second jump.
  humanoid.StateChanged:Connect(function(previous, state)
   if state == Enum.HumanoidStateType.Jumping then
    local groundTransition = previous == Enum.HumanoidStateType.Running or previous == Enum.HumanoidStateType.Landed or previous == Enum.HumanoidStateType.Climbing
    if Rules.invalidJump(session.airJumpSeen, groundTransition) then
     local root = character:FindFirstChild("HumanoidRootPart")
     if root and root.AssemblyLinearVelocity.Y > 0 then
      local velocity = root.AssemblyLinearVelocity
      root.AssemblyLinearVelocity = Vector3.new(velocity.X, 0, velocity.Z)
     end
    end
    session.airJumpSeen = true
    session.charge = 0
   end
  end)
  humanoid.Died:Connect(function()
   if session.ready then
    if not session.offer and not session.fallDismissed and session.current > 0 then session.offer = session.current end
    session.current, session.safeCurrent, session.grounded = 0, 0, false
    publish(player, session)
    task.spawn(save, player, session, false)
   end
  end)
  while not session.ready and player.Parent and character.Parent do task.wait(0.1) end
  if session.ready then
   local pending = session.record.pending
   if pending then session.current = pending.target end
   place(character, if pending then pending.target else session.current)
  end
 end
 player.CharacterAdded:Connect(setup)
 if player.Character then task.spawn(setup, player.Character) end
 task.spawn(function()
  -- Fail closed: a load/ownership failure never replaces saved data with defaults.
  while player.Parent and not session.ready do
   local ok, record = Store.update(player.UserId, function(value) return Rules.claim(value, session.token, os.time()) end)
   if ok then
    session.record, session.current, session.best, session.ready = record, record.current, record.best, true
    publish(player, session)
   else
    player:SetAttribute("SaveMessage", "저장소 연결 대기 중 · 진행 저장과 부활은 잠시 잠깁니다")
    task.wait(5)
   end
  end
  player:SetAttribute("SaveMessage", "")
 end)
end)
Action.OnServerEvent:Connect(function(player, action)
 local session = sessions[player]
 if not session or not session.ready or type(action) ~= "string" or os.clock() - session.lastAction < 0.8 then return end
 session.lastAction = os.clock()
 if action == "decline" then session.offer = nil; session.fallDismissed = true; publish(player, session); return end
 if action ~= "revive" or session.offer == nil then return end
 local existing = session.record.pending
 local target, request = if existing then existing.target else session.offer, if existing then existing.id else HttpService:GenerateGUID(false)
 task.spawn(function()
  local ok = transaction(player, session, function(record) return Rules.reserve(record, session.token, request, target) end)
  if not ok then player:SetAttribute("SaveMessage", "부활권이 부족하거나 저장할 수 없습니다"); return end
  session.offer = nil
  session.current = target
  local pending = session.record.pending
  if not player.Character or not player.Character:FindFirstChildOfClass("Humanoid") or player.Character.Humanoid.Health <= 0 then
   player:LoadCharacterAsync()
  else
   place(player.Character, pending.target)
  end
  publish(player, session)
 end)
end)
local elapsed = 0
RunService.Heartbeat:Connect(function(dt)
 elapsed += dt
 for player, session in sessions do
  local character = player.Character
  local humanoid = character and character:FindFirstChildOfClass("Humanoid")
  local root = character and character:FindFirstChild("HumanoidRootPart")
  if not humanoid or not root or humanoid.Health <= 0 or not session.ready then continue end
  local parameters = RaycastParams.new()
  parameters.FilterType = Enum.RaycastFilterType.Exclude
  parameters.FilterDescendantsInstances = {character}
  local hit = workspace:Raycast(root.Position, Vector3.new(0, -6, 0), parameters)
  local roof = hit and hit.Instance
  local id = roof and roof:GetAttribute("LandingId")
  local state = humanoid:GetState()
  local grounded = humanoid.FloorMaterial ~= Enum.Material.Air and state ~= Enum.HumanoidStateType.Jumping
  if id ~= session.probeRoof then session.stable = 0 end
  session.probeRoof = id
  session.stable = if grounded and Rules.finite(id) and math.abs(root.AssemblyLinearVelocity.Y) < 3 then session.stable + dt else 0
  if Rules.canLand(root.AssemblyLinearVelocity.Y, session.stable, id ~= nil) and Rules.canAdvance(session.current, id) then
   session.fallDismissed = Rules.nextDismissed(session.fallDismissed, not session.landingLatch)
   session.landingLatch = true
   if session.current ~= id then
    session.current, session.offer = id, nil
   end
   session.safeCurrent = id
   session.best = math.max(session.best, id)
   session.airJumpSeen = false
   session.charge += dt
   local pending = session.record.pending
   if pending and pending.target == id and not session.busy then
    task.spawn(function()
     transaction(player, session, function(record) return Rules.ack(record, session.token, pending.id) end)
    end)
   end
  else session.charge = 0; session.safeCurrent = 0; session.landingLatch = false end
  session.grounded = grounded
  local climbing = state == Enum.HumanoidStateType.Climbing
  session.stamina = Rules.stamina(session.stamina, climbing, grounded, dt)
  if climbing then session.airJumpSeen = false end -- native jump-off from a ladder is valid
  if climbing and session.stamina <= 0 then
   session.climbUntil = os.clock() + 1.5
   humanoid:ChangeState(Enum.HumanoidStateType.Freefall)
  end
  local canClimb = os.clock() >= session.climbUntil
  humanoid:SetStateEnabled(Enum.HumanoidStateType.Climbing, canClimb)
  humanoid:SetAttribute("CanClimb", canClimb)
  humanoid.JumpPower = Rules.power(session.charge)
  player:SetAttribute("Charge", math.clamp(session.charge / Rules.CHARGE_SECONDS, 0, 1))
  player:SetAttribute("Stamina", session.stamina)
  local lastRoof = destination(session.current)
  if session.current > 0 and lastRoof and Rules.shouldOffer(session.offer ~= nil, session.fallDismissed, root.Position.Y, lastRoof.Position.Y) then
   session.offer = session.current
   task.spawn(save, player, session, false)
  end
  publish(player, session)
 end
 if elapsed >= 30 then
  elapsed = 0
  for player, session in sessions do if session.ready then task.spawn(save, player, session, false) end end
 end
end)
Players.PlayerRemoving:Connect(function(player)
 local session = sessions[player]
 if session and session.ready then
  local deadline = os.clock() + 8
  while session.busy and os.clock() < deadline do task.wait(0.1) end
  save(player, session, true)
 end
 sessions[player] = nil
end)
game:BindToClose(function()
 local remaining = 0
 for player, session in sessions do
  if session.ready then
   remaining += 1
   task.spawn(function()
    local deadline = os.clock() + 10
    while session.busy and os.clock() < deadline do task.wait(0.1) end
    save(player, session, true)
    remaining -= 1
   end)
  end
 end
 local deadline = os.clock() + 25
 while remaining > 0 and os.clock() < deadline do task.wait(0.1) end
end)
-- No purchase prompt exists. Product 0 rejects every real receipt.
MarketplaceService.ProcessReceipt = function(receipt)
 if Rules.PRODUCT_ID == 0 or receipt.ProductId ~= Rules.PRODUCT_ID then return Enum.ProductPurchaseDecision.NotProcessedYet end
 local ok = Store.update(receipt.PlayerId, function(record) return Rules.receipt(record, receipt.PurchaseId, receipt.ProductId) end)
 return if ok then Enum.ProductPurchaseDecision.PurchaseGranted else Enum.ProductPurchaseDecision.NotProcessedYet
end
