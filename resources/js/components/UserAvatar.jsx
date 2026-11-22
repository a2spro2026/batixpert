import { useMemo } from 'react';

const ADMIN_AVATAR = '/images/admin-profile.jpg';

function getAvatarUrl(user) {
    if (user?.avatar) {
        if (user.avatar.startsWith('http') || user.avatar.startsWith('/')) {
            return user.avatar;
        }
        return `/storage/${user.avatar}`;
    }
    if (user?.is_admin) {
        return ADMIN_AVATAR;
    }
    const name = encodeURIComponent(user?.name || 'User');
    return `https://ui-avatars.com/api/?name=${name}&background=F97316&color=fff&size=128&bold=true&format=svg`;
}

export default function UserAvatar({ user, size = 'md', className = '' }) {
    const sizes = {
        sm: 'w-8 h-8',
        md: 'w-10 h-10',
        lg: 'w-11 h-11',
    };

    const avatarUrl = useMemo(() => getAvatarUrl(user), [user]);
    const isPhoto = Boolean(user?.avatar || user?.is_admin);

    return (
        <div
            className={`${sizes[size]} rounded-full overflow-hidden ring-2 ring-brand-orange/40 shadow-md shadow-orange-500/20 shrink-0 ${className}`}
            title={user?.name}
        >
            <img
                src={avatarUrl}
                alt={user?.name || 'Utilisateur'}
                className={`w-full h-full bg-brand-navy ${isPhoto ? 'object-cover object-[68%_12%]' : 'object-cover'}`}
            />
        </div>
    );
}
