import { navigation } from './navigation';

export const authorizationSections = navigation.map((section) => ({
    id: section.id,
    label: section.label,
    perm: section.perm,
    children: (section.children || []).map((child) => ({
        label: child.label,
        perm: child.perm,
        to: child.to,
    })),
}));

export function allAuthorizationPerms() {
    const slugs = [];
    authorizationSections.forEach((section) => {
        slugs.push(section.perm);
        section.children?.forEach((child) => slugs.push(child.perm));
    });
    return slugs;
}
