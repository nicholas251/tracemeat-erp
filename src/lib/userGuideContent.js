// Printable user manual content for the MeatTrace ERP system.
// Pure data so the guide page stays small and easy to update.

export const guideSections = [
  {
    id: "getting-started",
    title: "1. Getting Started",
    intro:
      "MeatTrace is the plant's production and traceability system. Everything flows in one direction: you buy raw materials, receive them into inventory, run production orders through their stages, pack finished goods, then sell and ship them. Every step records lot numbers so any finished case can be traced back to the supplier lots that went into it.",
    steps: [
      "Sign in with your company email. If you're new, you'll land on the profile screen and wait for an administrator to assign your work profile.",
      "Your work profile decides what you see. Operators see their production work; supervisors and admins see the full menu.",
      "Use the left sidebar to move around. On a phone or tablet, tap the menu button at the top to open it.",
      "The Dashboard is your home screen: active orders, open holds, carry-over cases waiting to be packed, and recent activity.",
    ],
    tips: [
      "If a screen looks empty, check that you're on the right tab (most screens have Active / Archived tabs).",
      "Data updates live — if a co-worker completes a stage, your screen refreshes on its own.",
    ],
  },
  {
    id: "setup",
    title: "2. One-Time Setup (Admins)",
    intro:
      "These screens define how the plant works. They're set up once and then changed only when a product or process changes. Only admins can edit them.",
    steps: [
      "Suppliers — add every vendor you buy from, with contact email and USDA establishment number.",
      "Raw Inventory → Buckets — create a bucket for each raw material you stock (each protein, spice, casing, packaging item). Buckets are what lots get received into and what recipes draw from.",
      "Spice Mixes — build each seasoning blend from spice buckets with per-batch quantities.",
      "Products — create each finished item: product number, SKU, case weight, packages per case, yield %, shelf life, and the production numbers (blend batch lbs, tumble batch lbs, lbs per rack, spice and cure per batch, casing usage).",
      "Recipes — the raw bucket quantities needed per batch for a product, plus the expected yield.",
      "Flow Builder — the ordered list of steps a product goes through (blending, chopping, tumbling, linking, racking, cooking, chilling, packing). This is what generates operator work cards.",
      "Work Profiles — job roles (Linker, Smokehouse Operator, Packager, etc.). Assign the capabilities each role can work, then assign your people to it.",
      "User Management — invite staff and set them as admin or standard user.",
    ],
    tips: [
      "Get Products and Flow Builder right before running real orders — production orders build their stages from the flow at the moment they're created.",
      "Yield % matters: 95% means 1,000 lbs in produces 950 lbs out. The system uses it to work out how much raw material an order needs.",
    ],
  },
  {
    id: "purchasing",
    title: "3. Purchasing & Receiving",
    intro: "How raw material gets into the building and into inventory.",
    steps: [
      "Purchase Orders → New PO. Pick the supplier, add line items (material, category, quantity, unit price), set the expected delivery date, and choose the ship-to address.",
      "Save the PO, then use Email PO to send it to the supplier. The status column shows whether the email went out or failed, and failed sends can be retried.",
      "Download the PDF at any time if you need a paper copy for the file.",
      "When the truck arrives, go to Receiving and open the PO. Enter the actual quantity received per line and the supplier's lot number for each. One line can take several lots if the delivery was mixed.",
      "Save the receipt. The system creates raw inventory lots in the matching buckets and updates the PO to partially received or received.",
    ],
    tips: [
      "Always enter the supplier's real lot number — it's the backbone of every recall search later.",
      "Receiving adds to what's already there, so a second delivery on the same PO won't wipe out the first.",
    ],
  },
  {
    id: "raw-inventory",
    title: "4. Raw Inventory",
    intro:
      "Raw Inventory shows every lot on hand, grouped by bucket, with quantity received and quantity still available. Production draws from these lots oldest-first (FIFO).",
    steps: [
      "Use the category filters to look at proteins, spices, casings, or packaging on their own.",
      "Open a bucket to see its individual lots, suppliers, received dates and remaining weight.",
      "Use Adjust to correct a count after a physical inventory, and note the reason.",
      "Spice Mixes → Produce Batch when you need to kit a blend. It pulls the component spice lots, records them on the mix batch, and gives you a mix lot number for the floor.",
    ],
    tips: [
      "A lot flips to depleted on its own when it hits zero — no need to clean it up manually.",
      "If production won't let you confirm a batch, check the bucket here first; you're most likely short.",
    ],
  },
  {
    id: "production",
    title: "5. Running Production",
    intro:
      "A production order is one run of one product. The order creates a work card for every step in the product's flow, and each card unlocks when the step before it finishes.",
    steps: [
      "Production Orders → New Order. Choose the product, then enter either the finished cases you need or total pounds — the system converts using case weight and yield and tells you how many batches that is.",
      "The shortage checker warns you before you start if a raw bucket doesn't have enough on hand.",
      "Save the order. Stage cards are created and the first step becomes available on the floor.",
      "Operators open My Work, pick their profile, and see only the cards they're qualified to run.",
      "Each card walks through its own steps: confirm the ingredient lots being used, record weights, temperatures and times, then confirm completion. Confirming deducts the raw lots and passes the batch to the next step.",
      "Blending and chopping check spice, cure and casing levels before letting you confirm, so you can't book a batch you didn't have material for.",
      "Tumbling splits the run into batches and releases racking cards as each batch goes out.",
      "Racking builds full racks and carries any part-full rack forward to the next racking card, so nothing is stranded or double-counted.",
      "Cooking and chilling record oven, temperature and time, and chilling sets the expiry date that follows the product to the finished case.",
      "Packing records cases (individual weights for variable-weight products), can split one cook batch across several products, and parks any leftover that doesn't fill a case as a carry-over case.",
      "Floor View is a read-only big-screen board showing what's running where — good for a monitor in the plant.",
    ],
    tips: [
      "Press a confirm button once. It disables itself while saving; tapping repeatedly can double-book a batch.",
      "Carry-over cases appear on the Dashboard's Carry-Over to Pack tab and can be added into a later run from the packing card.",
      "An order closes itself once its final step completes and moves to the Archived tab.",
    ],
  },
  {
    id: "finished-goods",
    title: "6. Finished Goods Inventory",
    intro:
      "Packing pushes cases into finished goods. Each product has a bucket holding its lots, with production date, expiry date, cases and pounds.",
    steps: [
      "Finished Goods shows pounds and cases on hand per product, with lots listed oldest-first.",
      "Open a bucket to see individual lots and which cook batch and order they came from.",
      "Use Adjust for physical count corrections, damage or shrink, with a note explaining why.",
    ],
    tips: [
      "Holds placed on finished goods automatically reduce the available on-hand figure, so Sales can't promise product that's locked up.",
    ],
  },
  {
    id: "sales",
    title: "7. Sales, Routes & Shipping",
    intro: "Orders out the door, priced per customer and assigned to a truck route.",
    steps: [
      "Customers — add the account with billing and ship-to details, payment terms and rep. Use Pricing on a customer to set their price per case or per pound by product.",
      "Sales Orders → New Order. Pick the customer, add products and case counts; pricing fills in automatically from that customer's price list.",
      "Assign the route and route date. Route Cards view groups everything going out on each truck.",
      "When the order is picked, use Fulfill. Choose the finished-goods lots being shipped — that's what links the customer to the lots they received.",
      "Print the packing slip for the driver.",
      "Fulfilling an order records the pounds into Daily Sales automatically.",
      "Daily Sales and Forecast show what's moving and what to build next; Cases Report summarises case counts over a date range.",
    ],
    tips: [
      "Only fulfil once — the lots are deducted at that moment, and editing the order afterwards won't double-record the sale.",
      "Weekly Close-Out clears the route board for the new week.",
    ],
  },
  {
    id: "quality",
    title: "8. Hold & Release (Quality)",
    intro:
      "Any product you don't trust gets held here, so it can't ship until someone signs it off.",
    steps: [
      "Hold & Release → Place Hold. Choose what you're holding (production order, raw material lot or finished goods lot), the reason, severity and the quantity affected, and describe the issue.",
      "Placing a hold on finished goods pulls that quantity out of available inventory immediately.",
      "When the investigation is done, open the hold and Release it back to inventory, or Reject / mark it destroyed. Record who reviewed it, the resolution and the corrective action taken.",
      "The Dashboard shows open holds so nothing sits forgotten.",
    ],
    tips: [
      "Fill in the corrective action — that's the field an auditor reads.",
    ],
  },
  {
    id: "traceability",
    title: "9. Traceability & Recall",
    intro:
      "Traceability answers both directions: what went into this case, and where did this supplier lot end up.",
    steps: [
      "Traceability — search any lot number: a supplier lot, a batch lot, a cook batch lot or a finished-goods lot.",
      "The result shows every production order affected, the full chain of stages with the exact lots each one consumed, the racks and cook batches, the carry-overs packed in, the finished-goods lots produced, and the customer shipments those lots went out on.",
      "Use the recall summary to see total pounds and cases exposed, and which customers need calling.",
      "From there you can place holds on the affected finished-goods lots.",
    ],
    tips: [
      "Traceability is only as good as the lot entries at receiving and on each stage card. Skipping a lot entry breaks the chain.",
    ],
  },
  {
    id: "housekeeping",
    title: "10. Housekeeping & Troubleshooting",
    intro: "Routine care and the things that most often need a second look.",
    steps: [
      "Completed production orders archive themselves; use the Archived tab to review history.",
      "Admins can archive or delete a purchase order or sales order that was entered by mistake.",
      "If an operator can't confirm a batch, check the raw bucket level and the spice mix on-hand first.",
      "If a stage card looks stuck, reload the page — the card may have already been completed by someone else.",
      "The destructive reset tools are limited to named administrators. They delete production stages and racks permanently and cannot be undone.",
    ],
    tips: [
      "Do a physical count of raw and finished inventory on a set schedule and correct it with Adjust, noting the reason each time.",
    ],
  },
];

// Detailed walk-through of creating a production order.
export const orderSetupSteps = [
  {
    title: "Before you create the order",
    points: [
      "The product must exist and be active, with case weight, packages per case, yield %, shelf life and its per-batch production numbers filled in (blend batch lbs or tumble batch lbs, lbs per rack, spice per batch, cure per batch, casing per batch).",
      "The product must be pointed at a recipe (raw bucket quantities per batch) and at a flow (the ordered list of steps).",
      "Any spice mix the product uses should already have a produced batch on hand, or the floor will be blocked at the seasoning step.",
      "Work profiles must have people assigned, or the work cards will appear with nobody able to open them.",
    ],
  },
  {
    title: "Creating the order",
    points: [
      "Production Orders → New Order. The order number is generated for you; you can overwrite it if you use your own numbering.",
      "Choose the product. The recipe, flow and supplier fields fill in from the product.",
      "Enter the quantity. Toggle between finished cases and total pounds — the system converts using case weight, and works backwards through the yield % to get the raw pounds you must start with.",
      "Read the summary: raw input pounds required, expected finished pounds, expected cases, and how many batches that becomes at this product's batch size.",
      "Check the shortage panel. It compares every raw bucket the recipe needs against what's on hand and flags anything short. Fix the shortage or reduce the order before saving.",
      "Set the order date and target completion date, add notes for the floor, and save.",
    ],
  },
  {
    title: "What happens when you save",
    points: [
      "One work card (a stage) is created for every step in the product's flow, in order.",
      "Step 1 becomes Available. Every later step is Locked until the step before it completes.",
      "Order status moves from Pending to In Progress as soon as the first card is started.",
      "Nothing is deducted from inventory yet — raw lots come out only when an operator confirms an actual batch.",
    ],
  },
  {
    title: "While the order runs",
    points: [
      "Open the order and expand the stages panel to see every card, its status, weights in and out, and its lot numbers.",
      "Floor View gives the same picture as a read-only board for a plant monitor.",
      "Steps that split into batches (blending, tumbling, racking, cook batches) create additional cards as batches are released — so the card count grows during the run, which is normal.",
      "Put the order on hold from Hold & Release if quality stops the run; release it to resume.",
    ],
  },
  {
    title: "Finishing the order",
    points: [
      "When the last step in the flow completes, the order marks itself Completed and moves to the Archived tab.",
      "Finished cases land in Finished Goods with a lot number, production date and expiry date.",
      "Any leftover that didn't fill a case becomes a carry-over case on the Dashboard, ready to be packed into a later run.",
      "Admins can delete an order that was created by mistake, but only before batches have been confirmed against it.",
    ],
  },
];

// Stage-by-stage expectations for each production flow in the plant.
export const flowWalkthroughs = [
  {
    name: "Hot Dog / Emulsified Flow",
    summary:
      "Blend proteins → chop with seasoning and cure → mix → link into casings → rack → smokehouse cook → chill → pack.",
    stages: [
      {
        name: "Blending",
        what:
          "Weigh out the protein buckets for one blend batch. Confirm the exact raw lot for each protein — the picker shows oldest lots first. Record actual blended weight. Confirming deducts those lots and gives the batch its blend lot number. Large orders release several blend batches; each one is its own card and its own lot.",
      },
      {
        name: "Chopping (bowl chopper)",
        what:
          "Takes one blend batch. Confirm the spice mix lot, the cure lot and the water added, all per the product's per-batch amounts. The system checks spice and cure are actually on hand and refuses to confirm if you're short. Record chopped output weight; the batch carries its own lot forward.",
      },
      {
        name: "Mixer",
        what:
          "Combines the chopped protein batch with the binder batch. Record binder lot and quantity plus mixing time, then confirm the mixed output weight.",
      },
      {
        name: "Linking",
        what:
          "Confirm the casing lot and quantity used (skipped for products marked no casings). Record links produced by weight. If the product merges batches, several filling batches combine into one cook batch at the configured ratio.",
      },
      {
        name: "Racking",
        what:
          "Build full racks at the product's lbs-per-rack figure. Any part-full rack is carried to the next racking card and topped up there, so partials are never stranded or double counted. Racks are numbered in one sequence across the whole order.",
      },
      {
        name: "Cooking (smokehouse)",
        what:
          "Assign the oven and the racks going in, then record the actual temperature, cook method and cook time against the product's target. Confirm the cooked weight out — this is where cook yield shows up.",
      },
      {
        name: "Chilling",
        what:
          "Record chill temperature and time, and confirm the chilled weight. The expiry date is calculated here from the product's shelf life and follows the product all the way to the finished case.",
      },
      {
        name: "Packing",
        what:
          "Record cases packed, with individual case weights for variable-weight products. You can split one cook batch across several products, and you can pull an open carry-over case in first (tick the carry-over box at the top before you start counting). Confirming pushes cases into Finished Goods with a lot number and closes the order.",
      },
    ],
  },
  {
    name: "Kielbasa / Coarse Ground Flow",
    summary:
      "Same backbone as the hot dog flow, with a separate pork batch and binder batch paired by batch tag.",
    stages: [
      {
        name: "Blending / Grinding",
        what: "Weigh and confirm the pork and beef lots for the batch. Each batch gets a pork batch lot number.",
      },
      {
        name: "Bowl chopper (binder)",
        what:
          "Produces the binder batch that will go into the mixer. It gets its own binder lot number and is paired to its pork batch by batch tag, so the two always end up in the same mix.",
      },
      {
        name: "Mixer",
        what:
          "Pork batch plus binder batch plus the spice mix and cure for that batch size. Spice and cure levels are checked before confirmation. Record mixing time and mixed weight.",
      },
      { name: "Linking", what: "Confirm the casing lot and quantity, and record linked weight." },
      { name: "Racking", what: "Fill racks to the product's lbs-per-rack figure; trailing partials carry forward." },
      { name: "Cooking", what: "Smokehouse: oven, temperature, cook method and time; confirm cooked weight." },
      { name: "Chilling", what: "Chill temperature and time; expiry date is set here." },
      { name: "Packing", what: "Cases counted and weighed, splits and carry-overs handled, cases pushed to Finished Goods." },
    ],
  },
  {
    name: "Tumbled / Marinated Flow (whole muscle)",
    summary: "Tumble in batches → rack → cook → chill → pack. No grinding or linking.",
    stages: [
      {
        name: "Tumbling",
        what:
          "The order's total weight is split into batches at the product's tumble batch size. For each batch, confirm the protein lots and the tumble spice quantity, then record tumble time. Releasing a batch deducts its lots and immediately creates a racking card for that batch, so racking can start while later batches are still tumbling. The tumble card completes on its own once every batch is released.",
      },
      {
        name: "Racking",
        what:
          "Each released tumble batch gets its own racking card. Build full racks; a trailing partial rack goes into the order's carry-over queue and is picked up by whichever racking card opens next. Rack numbers run in a single sequence across the whole order so no two racks share a number.",
      },
      {
        name: "Cooking",
        what: "Assign racks to an oven, record temperature and time, and confirm cooked weight for that cook batch.",
      },
      { name: "Chilling", what: "One cooling batch per cook batch. Record chill temperature and time; expiry date is set here." },
      {
        name: "Packing",
        what:
          "One packing card per cooling batch. Count and weigh cases, split across products if needed, pull in carry-overs first, and confirm to push finished cases into inventory.",
      },
    ],
  },
  {
    name: "Sous Vide Flow (bulk gaylords)",
    summary: "Tumble or blend → rack → cook → chill → pack into gaylords instead of cases.",
    stages: [
      { name: "Prep / Tumbling", what: "Confirm protein and seasoning lots per batch as in the tumbled flow." },
      { name: "Racking", what: "Racks are numbered and tracked individually because gaylords report which racks fed them." },
      { name: "Cooking", what: "Cook batch recorded with oven, temperature and time." },
      { name: "Chilling", what: "Chill recorded and expiry date set." },
      {
        name: "Sous vide packing",
        what:
          "Open a gaylord, then add rack weights into it. Each rack records which gaylord it fed and how much, so a gaylord built from more than one cook batch is flagged as a mixed lot with all its source lots listed. Seal the gaylord to give it its finished lot number and push it into Finished Goods. Open the next gaylord and continue until every rack is packed.",
      },
    ],
  },
];

export const guideRoles = [
  { role: "Administrator", access: "Everything, including setup screens, users, pricing, and reset tools." },
  { role: "Supervisor", access: "Production, quality, inventory, sales and reporting. No user management." },
  { role: "Quality Control", access: "Production visibility, hold & release, traceability, inventory." },
  { role: "Warehouse Operator", access: "Receiving, purchase orders, raw and finished inventory, sales fulfilment." },
  { role: "Production Worker", access: "My Work cards for their steps, products, holds, finished goods." },
  { role: "Tumble Operator", access: "Tumbling and racking work cards, spice mixes, raw materials." },
];