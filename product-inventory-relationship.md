# Products, Stock & Inventory — How They Relate

---

## The Core Idea

These three are often confused because they sound similar. Here's the distinction in one line each:

- **Product** — *what* something is. Just a definition. Has no quantity, no location.
- **Inventory** — *where* a product is and *how many* exist at that location. It is the link between a product and a store.
- **Stock** — not a separate concept. Stock IS the quantity number sitting inside an inventory record.

---

## The Dependency Chain

```
Category
   └── Product
            └── Inventory (Product + Store + Quantity)
                     └── Sales (reduces quantity)
                     └── Supply (increases quantity)
```

You cannot create inventory without a product. You cannot create a product without a category. You cannot record a sale without an inventory record existing first.

---

## Creation Order — Step by Step

### Step 1: Categories (done once, seeded)

The system starts with two fixed categories: **Mobiles** and **Accessories**. Nobody creates these — they are pre-loaded when the system is deployed.

### Step 2: Create a Store

Before anything else, the store location must exist. You need a store to attach inventory to.

### Step 3: Create a Product

Admin creates a product — name, category, purchase price, selling price. At this point the product exists in the catalog but **has no quantity and no location**. It is just a definition sitting in the products table.

```
products table:
| id | name         | category    | purchase_price | selling_price |
|----|--------------|-------------|----------------|---------------|
|  1 | iPhone 15    | Mobiles     | 800            | 1000          |
|  2 | USB-C Cable  | Accessories | 5              | 15            |
```

### Step 4: Supply the Product to a Store (Inventory is Born)

Admin sends stock to a store. This is the moment an inventory record is created — it ties the product to a specific store with a quantity. **This is what creates stock.**

```
inventory table:
| id | product_id | store_id | quantity |
|----|------------|----------|----------|
|  1 |     1      |    1     |   50     |   ← iPhone 15 at Store A: 50 units
|  2 |     1      |    2     |   30     |   ← iPhone 15 at Store B: 30 units
|  3 |     2      |    1     |  200     |   ← USB-C Cable at Store A: 200 units
```

Notice: the same product appears twice — once per store. Each row is independent. The iPhone 15 at Store A has 50 units, at Store B has 30. They do not affect each other.

### Step 5: Sales (Quantity Goes Down)

A branch manager at Store A logs a sale of 3 iPhone 15s. The system finds the inventory record for `product_id=1, store_id=1` and subtracts 3.

```
Before sale: quantity = 50
After sale:  quantity = 47
```

A record is also written to the `sales` table for history, but the live number lives in `inventory.quantity`.

### Step 6: Resupply (Quantity Goes Up)

Admin sends 20 more iPhone 15s to Store A. The system finds the same inventory record and adds 20. A record is written to `stock_supplies` for history.

```
After resupply: quantity = 67
```

---

## What Happens If a Product Is Not Supplied to a Store?

No inventory record exists for that product-store combination. The branch manager at that store will not see the product in their sales form at all. The product exists in the system but has zero presence at that store.

---

## Summary Table

| Entity    | What it represents             | Has quantity? | Has location? | Created by         |
|-----------|--------------------------------|---------------|---------------|--------------------|
| Category  | Type grouping                  | No            | No            | System seed        |
| Product   | What the item is + its prices  | No            | No            | Admin              |
| Inventory | Product at a specific store    | Yes           | Yes           | Admin (via supply) |
| Sale      | A reduction event on inventory | Yes (sold)    | Yes           | Branch Manager     |
| Supply    | An addition event on inventory | Yes (added)   | Yes           | Admin              |

---

## One-Line Summary

Create the category and store first, then create the product, then supply it to a store — that supply action is what creates the inventory record and makes the product available for sale.
