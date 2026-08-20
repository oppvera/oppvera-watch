import {
	APP_NAME,
	BRAND_LOGO_DARK,
	BRAND_LOGO_LIGHT,
} from "@/lib/branding";
import { cn } from "@oneglanse/utils";
import type { JSX } from "react";

type BrandLockupProps = {
	className?: string;
	logoClassName?: string;
	nameClassName?: string;
	showName?: boolean;
};

export function BrandLockup({
	className,
	logoClassName,
	nameClassName,
	showName = true,
}: BrandLockupProps): JSX.Element {
	return (
		<div className={cn("flex items-center gap-2.5", className)}>
			<img
				src={BRAND_LOGO_LIGHT}
				alt={APP_NAME}
				className={cn(
					"h-8 w-8 object-contain dark:hidden sm:h-9 sm:w-9",
					logoClassName,
				)}
			/>
			<img
				src={BRAND_LOGO_DARK}
				alt={APP_NAME}
				className={cn(
					"hidden h-8 w-8 object-contain dark:block sm:h-9 sm:w-9",
					logoClassName,
				)}
			/>
			{showName ? (
				<div
					className={cn(
						"text-[1.4rem] font-semibold tracking-[-0.05em] text-gray-950 sm:text-[1.75rem] dark:text-gray-50",
						nameClassName,
					)}
				>
					{APP_NAME}
				</div>
			) : null}
		</div>
	);
}
