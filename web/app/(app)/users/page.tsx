"use client";
import { Plus, Pencil, PowerOff, Power } from "lucide-react";
import { PageHeader }  from "@/components/ui/page-header";
import { Button }      from "@/components/ui/button";
import { FilterBtn, Search } from "@/components/ui/search";
import { Badge, StatusBadge, RoleBadge } from "@/components/ui/badge";
import { USERS }       from "@/lib/data";

export default function UsersPage() {
  return (
    <>
      <PageHeader
        title="Users"
        desc="Admins and branch managers"
        action={<Button Icon={Plus}>Add User</Button>}
      />

      <div className="filterbar">
        <FilterBtn label="All roles" />
        <FilterBtn label="All status" />
        <Search placeholder="Search name or email…" value="" onChange={() => {}} />
      </div>

      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th><th>Email</th><th>Role</th><th>Store</th>
              <th>Status</th><th>Created</th><th className="r">Actions</th>
            </tr>
          </thead>
          <tbody>
            {USERS.map((r) => (
              <tr key={r.id}>
                <td className="strong">{r.name}</td>
                <td className="muted">{r.email}</td>
                <td><RoleBadge role={r.role} /></td>
                <td>{r.store ? r.store.split(" — ")[0] : "—"}</td>
                <td><StatusBadge active={r.active} /></td>
                <td className="muted">{r.created}</td>
                <td>
                  <div className="actions">
                    <button className="act-btn" title="Edit"><Pencil size={16} /></button>
                    <button className={`act-btn${r.active ? " danger" : ""}`} title={r.active ? "Deactivate" : "Reactivate"}>
                      {r.active ? <PowerOff size={16} /> : <Power size={16} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
