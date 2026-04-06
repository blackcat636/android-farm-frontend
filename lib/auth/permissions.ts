export type EffectivePermissionLike = {
  key: string;
  effect: 'allow' | 'deny';
};

export function can(
  permissions: EffectivePermissionLike[] | undefined,
  permissionKey: string,
): boolean {
  if (!permissions?.length) return false;
  const item = permissions.find((p) => p.key === permissionKey);
  return item?.effect === 'allow';
}

export function canAny(
  permissions: EffectivePermissionLike[] | undefined,
  permissionKeys: string[],
): boolean {
  return permissionKeys.some((key) => can(permissions, key));
}
