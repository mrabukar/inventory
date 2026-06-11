import type {
  Summary, Product, InventoryRow, Sale,
  SupplyRow, User, AuditRow, FeedItem,
} from "./types";

export const STORES = [
  "Store A — Downtown",
  "Store B — Riverside",
  "Store C — Airport",
  "Store D — Westgate",
];

export const SUMMARY: Summary = {
  total_revenue: 124500, gross_profit: 46300, net_profit: 33500,
  total_expenses: 12800, current_stock_value: 88040,
  in_stock_balance: 1342, low_stock_count: 7, units_sold: 486, cogs: 78200,
};

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

export const REV_COGS_EXP = [
  { m: "Jan", rev: 92000,  cogs: 60000, exp: 11000 },
  { m: "Feb", rev: 101000, cogs: 64000, exp: 10200 },
  { m: "Mar", rev: 88000,  cogs: 58000, exp: 12500 },
  { m: "Apr", rev: 116000, cogs: 72000, exp: 11800 },
  { m: "May", rev: 109000, cogs: 69000, exp: 13400 },
  { m: "Jun", rev: 124500, cogs: 78200, exp: 12800 },
];

export const NET_PROFIT = [21000, 26800, 17500, 32200, 26600, 33500];

export const EXPENSE_BREAKDOWN = [
  { label: "Rent",      value: 4800, color: "var(--brand-indigo)" },
  { label: "Salaries",  value: 3600, color: "var(--brand-teal)"   },
  { label: "Utilities", value: 1700, color: "var(--brand-violet)" },
  { label: "Logistics", value: 1500, color: "var(--status-amber)" },
  { label: "Marketing", value:  800, color: "var(--status-emerald)" },
  { label: "Other",     value:  400, color: "var(--cost-slate)"   },
];

export const TOP_PRODUCTS = [
  { name: "iPhone 15",   units: 142 },
  { name: "USB-C Cable", units: 118 },
  { name: "Galaxy S24",  units:  96 },
  { name: "AirPods Pro", units:  74 },
  { name: "Charger 30W", units:  56 },
];

export const TOP_STORES = [
  { name: "Store A", rev: 48200 },
  { name: "Store D", rev: 33100 },
  { name: "Store B", rev: 27500 },
  { name: "Store C", rev: 15700 },
];

export const PRODUCTS: Product[] = [
  { id: "p1", name: "iPhone 15",        cat: "Mobiles",     purchase: 720,  sell: 1000, active: true,  by: "Walaa A." },
  { id: "p2", name: "Galaxy S24",       cat: "Mobiles",     purchase: 640,  sell: 899,  active: true,  by: "Walaa A." },
  { id: "p3", name: "Pixel 8",          cat: "Mobiles",     purchase: 520,  sell: 749,  active: true,  by: "Omar K."  },
  { id: "p4", name: "AirPods Pro",      cat: "Accessories", purchase: 140,  sell: 249,  active: true,  by: "Walaa A." },
  { id: "p5", name: "USB-C Cable",      cat: "Accessories", purchase: 2.2,  sell: 9,    active: true,  by: "Omar K."  },
  { id: "p6", name: "30W Charger",      cat: "Accessories", purchase: 9,    sell: 29,   active: true,  by: "Walaa A." },
  { id: "p7", name: "Screen Protector", cat: "Accessories", purchase: 1.1,  sell: 7,    active: false, by: "Omar K."  },
];

export const INVENTORY: InventoryRow[] = [
  { id: "i1", product: "iPhone 15",   cat: "Mobiles",     store: "Store A — Downtown",  qty: 47, threshold: 15, purchase: 720,  updated: "2h ago"  },
  { id: "i2", product: "Galaxy S24",  cat: "Mobiles",     store: "Store A — Downtown",  qty: 12, threshold: 15, purchase: 640,  updated: "5h ago"  },
  { id: "i3", product: "USB-C Cable", cat: "Accessories", store: "Store B — Riverside", qty:  8, threshold: 40, purchase: 2.2,  updated: "1d ago"  },
  { id: "i4", product: "AirPods Pro", cat: "Accessories", store: "Store A — Downtown",  qty:  0, threshold: 10, purchase: 140,  updated: "3d ago"  },
  { id: "i5", product: "Pixel 8",     cat: "Mobiles",     store: "Store C — Airport",   qty: 23, threshold: 10, purchase: 520,  updated: "6h ago"  },
  { id: "i6", product: "30W Charger", cat: "Accessories", store: "Store D — Westgate",  qty: 64, threshold: 30, purchase: 9,    updated: "2d ago"  },
  { id: "i7", product: "iPhone 15",   cat: "Mobiles",     store: "Store B — Riverside", qty:  9, threshold: 15, purchase: 720,  updated: "4h ago"  },
];

export const SALES: Sale[] = [
  { id: "s1", date: "Jun 03", store: "Store A — Downtown",  product: "iPhone 15",   cat: "Mobiles",     manager: "Walaa A.", qty:  3, unit: 1000, profit:  840, status: "active"    },
  { id: "s2", date: "Jun 03", store: "Store B — Riverside", product: "USB-C Cable", cat: "Accessories", manager: "Sara M.",  qty: 24, unit: 9,    profit:  163, status: "active"    },
  { id: "s3", date: "Jun 02", store: "Store C — Airport",   product: "Pixel 8",     cat: "Mobiles",     manager: "Tariq H.",qty:  2, unit: 749,  profit:  458, status: "corrected" },
  { id: "s4", date: "Jun 02", store: "Store A — Downtown",  product: "AirPods Pro", cat: "Accessories", manager: "Walaa A.", qty:  5, unit: 249,  profit:  545, status: "active"    },
  { id: "s5", date: "Jun 01", store: "Store D — Westgate",  product: "30W Charger", cat: "Accessories", manager: "Lina R.",  qty: 12, unit: 29,   profit:  240, status: "active"    },
  { id: "s6", date: "Jun 01", store: "Store B — Riverside", product: "Galaxy S24",  cat: "Mobiles",     manager: "Sara M.",  qty:  1, unit: 899,  profit:  259, status: "active"    },
];

export const SUPPLY: SupplyRow[] = [
  { id: "su1", date: "Jun 03", product: "iPhone 15",   cat: "Mobiles",     store: "Store A — Downtown",  qty:  50, unit: 720, by: "Walaa A.", note: "Monthly restock"         },
  { id: "su2", date: "Jun 02", product: "USB-C Cable", cat: "Accessories", store: "Store B — Riverside", qty: 200, unit: 2.2, by: "Omar K.",  note: ""                        },
  { id: "su3", date: "Jun 01", product: "Galaxy S24",  cat: "Mobiles",     store: "Store A — Downtown",  qty:  -4, unit: 640, by: "Walaa A.", note: "Damaged units returned"  },
  { id: "su4", date: "May 30", product: "30W Charger", cat: "Accessories", store: "Store D — Westgate",  qty:  80, unit: 9,   by: "Walaa A.", note: ""                        },
];

export const USERS: User[] = [
  { id: "u1", name: "Walaa Ahmad",   email: "walaa@inventory.app",  role: "admin",          store: null,                 active: true,  created: "Jan 12, 2026", by: "system"    },
  { id: "u2", name: "Omar Khalil",   email: "omar@inventory.app",   role: "admin",          store: null,                 active: true,  created: "Feb 02, 2026", by: "Walaa A."  },
  { id: "u3", name: "Sara Mansour",  email: "sara@inventory.app",   role: "branch_manager", store: "Store B — Riverside",active: true,  created: "Feb 18, 2026", by: "Walaa A."  },
  { id: "u4", name: "Tariq Hassan",  email: "tariq@inventory.app",  role: "branch_manager", store: "Store C — Airport",  active: true,  created: "Mar 04, 2026", by: "Omar K."   },
  { id: "u5", name: "Lina Rahman",   email: "lina@inventory.app",   role: "branch_manager", store: "Store D — Westgate", active: false, created: "Mar 22, 2026", by: "Walaa A."  },
];

export const AUDIT: AuditRow[] = [
  { id: "a1", ts: "Jun 03, 14:22", user: "Walaa Ahmad", role: "admin",          action: "STOCK_SUPPLIED",   entity: "supply #2041",  store: "Store A — Downtown", source: "Web · 10.4.18.2",  summary: "Supplied 50 × iPhone 15 to Store A",              before: null, after: { id: 2041, product: "iPhone 15", store_id: "A", quantity: 50, unit_cost: 740.00, total_investment: 37000.00, supplied_by: "Walaa Ahmad", note: "Q2 restock — pallet 3" } },
  { id: "a2", ts: "Jun 03, 11:08", user: "Sara Mansour",role: "branch_manager", action: "SALE_CREATED",     entity: "sale #1042",    store: "Store B — Riverside",source: "Web · 10.4.22.9",  summary: "Recorded 24 × USB-C Cable",                        before: null, after: { id: 1042, product: "USB-C Cable", store_id: "B", quantity: 24, unit_price: 12.00, total: 288.00, unit_cost: 4.20, profit: 187.20, recorded_by: "Sara Mansour" } },
  { id: "a3", ts: "Jun 02, 16:45", user: "Tariq Hassan", role: "branch_manager",action: "SALE_CORRECTED",  entity: "sale #1039",    store: "Store C — Airport",  source: "Web · 10.4.31.5",  summary: "Corrected qty 3 → 2 on Pixel 8",                   before: { id: 1039, product: "Pixel 8", quantity: 3, unit_price: 599.00, total: 1797.00, profit: 447.00, status: "active" }, after: { id: 1039, product: "Pixel 8", quantity: 2, unit_price: 599.00, total: 1198.00, profit: 298.00, status: "corrected" } },
  { id: "a4", ts: "Jun 02, 09:30", user: "Walaa Ahmad", role: "admin",          action: "EXPENSE_CREATED",  entity: "expense #318",  store: "Company-wide",       source: "Web · 10.4.18.2",  summary: "Added June Electricity Bill",                       before: null, after: { id: 318, title: "June Electricity Bill", category: "Utilities", amount: 1240.00, store_id: null, date: "2026-06-02", created_by: "Walaa Ahmad" } },
  { id: "a5", ts: "Jun 01, 17:12", user: "Omar Khalil",  role: "admin",          action: "PRODUCT_UPDATED",  entity: "product #5",    store: "Company-wide",       source: "Web · 10.4.18.7",  summary: "Updated selling price on USB-C Cable",             before: { id: 5, name: "USB-C Cable", category: "Accessories", purchase_price: 4.20, selling_price: 10.00, active: true }, after: { id: 5, name: "USB-C Cable", category: "Accessories", purchase_price: 4.20, selling_price: 12.00, active: true } },
  { id: "a6", ts: "Jun 01, 08:05", user: "Walaa Ahmad", role: "admin",          action: "USER_DEACTIVATED", entity: "user #5",       store: "Company-wide",       source: "Web · 10.4.18.2",  summary: "Deactivated Lina Rahman",                          before: { id: 5, name: "Lina Rahman", role: "branch_manager", store_id: "D", active: true }, after: { id: 5, name: "Lina Rahman", role: "branch_manager", store_id: "D", active: false } },
];

export const FEED: FeedItem[] = [
  { icon: "Truck",        color: "indigo", text: "<b>Walaa Ahmad</b> supplied 50 × iPhone 15 to Store A",          time: "2 hours ago"  },
  { icon: "ShoppingCart", color: "teal",   text: "<b>Sara Mansour</b> recorded a sale of 24 × USB-C Cable",        time: "5 hours ago"  },
  { icon: "CreditCard",   color: "amber",  text: '<b>Walaa Ahmad</b> added expense "June Electricity Bill"',       time: "8 hours ago"  },
  { icon: "SquarePen",    color: "rose",   text: "<b>Tariq Hassan</b> corrected sale #1039 (Pixel 8)",             time: "1 day ago"    },
  { icon: "UserX",        color: "violet", text: "<b>Walaa Ahmad</b> deactivated user Lina Rahman",                time: "1 day ago"    },
];
