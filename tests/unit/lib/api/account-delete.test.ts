// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";

import { deleteAccount } from "@/lib/api/account";

const UID = "10f13b40-0000-4000-8000-000000000000";
let order: string[];
let removeResult: { data: unknown; error: unknown };

function admin() {
  return {
    from: (table: string) => ({ insert: async (row: unknown) => (order.push(`${table}:${JSON.stringify(row)}`), { error: null }) }),
    storage: {
      from: (bucket: string) => ({
        remove: async (paths: string[]) => (order.push(`remove:${bucket}:${paths.join(",")}`), removeResult),
      }),
    },
    auth: { admin: { deleteUser: async (id: string) => (order.push(`deleteUser:${id}`), { error: null }) } },
  } as never;
}

beforeEach(() => {
  order = [];
  removeResult = { data: [], error: null };
});

describe("deleteAccount", () => {
  it("audits, removes exactly the owner's preview, then deletes the auth user", async () => {
    await deleteAccount(admin(), UID);
    expect(order).toEqual([
      `audit_log:${JSON.stringify({ user_id: UID, action: "account.delete" })}`,
      `remove:bunker-previews:${UID}/scene.png`,
      `deleteUser:${UID}`,
    ]);
  });

  it("continues when the bucket does not exist", async () => {
    removeResult = { data: null, error: { status: 400, statusCode: "BucketNotFound" } };
    await deleteAccount(admin(), UID);
    expect(order.at(-1)).toBe(`deleteUser:${UID}`);
  });

  it("stops before deleting the user when storage really fails", async () => {
    removeResult = { data: null, error: { status: 500, statusCode: "500", message: "boom" } };
    await expect(deleteAccount(admin(), UID)).rejects.toMatchObject({ statusCode: "500" });
    expect(order.some((o) => o.startsWith("deleteUser"))).toBe(false);
  });
});
