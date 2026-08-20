"use client";

import { cn } from "@oneglanse/utils";

function getInitial(name: string, email?: string): string {
	const source = name.trim() || email?.trim() || "";
	return source.charAt(0).toUpperCase() || "?";
}

export function UserInitials({
	name,
	email,
	className,
}: {
	name: string;
	email?: string;
	className?: string;
}) {
	const initial = getInitial(name, email);

	return (
		<div
			aria-hidden="true"
			className={cn(
				"flex size-6 shrink-0 items-center justify-center rounded-full bg-gray-950 font-semibold text-white dark:bg-white dark:text-gray-950",
				className,
			)}
			style={{ fontSize: 12, lineHeight: 1 }}
		>
			{initial}
		</div>
	);
}
