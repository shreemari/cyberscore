import { Level, OrgMode, Role } from '@cymetric/types';

const ALL_LEVELS: Level[] = [Level.PEOPLE, Level.PROCESS, Level.COMPANY];

// effectiveAllowedLevels — admins (and SOLO orgs, which only have one user
// who's effectively admin) always get every level regardless of what's stored
// on the row. Employees get whatever the admin assigned them. This keeps the
// gate honest even if the column drifts (admin demoted to manager, then
// promoted back, etc.) and avoids backfilling on role flips.
export function effectiveAllowedLevels(args: {
  role: Role;
  orgMode: OrgMode;
  allowedLevels: Level[];
}): Level[] {
  if (args.orgMode === OrgMode.SOLO || args.role === Role.ADMIN) {
    return ALL_LEVELS;
  }
  return args.allowedLevels;
}

export function canAssessLevel(
  args: { role: Role; orgMode: OrgMode; allowedLevels: Level[] },
  level: Level,
): boolean {
  return effectiveAllowedLevels(args).includes(level);
}
