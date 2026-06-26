/** Shared TMDB company ids for global movie studio charts. */

export const STUDIO_IMG_BASE =
	"https://raw.githubusercontent.com/hfip/Fusion_Collec/main/Studios/";

export interface StudioSection {
	blockIdSuffix: string;
	title: string;
	label: string;
	companyId: number;
	img: string;
}

export const GLOBAL_STUDIOS: StudioSection[] = [
	{
		blockIdSuffix: "studio-20th-century",
		title: "20th Century Studios",
		label: "20th Century",
		companyId: 127928,
		img: "20th%20Century%20Studios.png",
	},
	{
		blockIdSuffix: "studio-a24",
		title: "A24",
		label: "A24",
		companyId: 41077,
		img: "A24.png",
	},
	{
		blockIdSuffix: "studio-amblin",
		title: "Amblin Entertainment",
		label: "Amblin",
		companyId: 56,
		img: "Amblin%20Entertainment.png",
	},
	{
		blockIdSuffix: "studio-columbia",
		title: "Columbia Pictures",
		label: "Columbia",
		companyId: 3614,
		img: "Columbia%20Pictures.png",
	},
	{
		blockIdSuffix: "studio-dc",
		title: "DC Studios",
		label: "DC",
		companyId: 429,
		img: "DC.png",
	},
	{
		blockIdSuffix: "studio-dreamworks",
		title: "DreamWorks Pictures",
		label: "DreamWorks",
		companyId: 7,
		img: "DreamWorks%20Pictures.png",
	},
	{
		blockIdSuffix: "studio-legendary",
		title: "Legendary Pictures",
		label: "Legendary",
		companyId: 923,
		img: "Legendary.png",
	},
	{
		blockIdSuffix: "studio-lionsgate",
		title: "Lionsgate",
		label: "Lionsgate",
		companyId: 1632,
		img: "Lionsgate.png",
	},
	{
		blockIdSuffix: "studio-lucasfilm",
		title: "Lucasfilm Ltd.",
		label: "Lucasfilm",
		companyId: 1,
		img: "Lucasfilm%20Ltd..png",
	},
	{
		blockIdSuffix: "studio-mgm",
		title: "Metro Goldwyn Mayer",
		label: "MGM",
		companyId: 21,
		img: "Metro-Goldwyn-Mayer.png",
	},
	{
		blockIdSuffix: "studio-millennium",
		title: "Millennium Media",
		label: "Millennium",
		companyId: 1020,
		img: "Millennium%20Media.png",
	},
	{
		blockIdSuffix: "studio-miramax",
		title: "Miramax",
		label: "Miramax",
		companyId: 14,
		img: "Miramax.png",
	},
	{
		blockIdSuffix: "studio-newline",
		title: "New Line Cinema",
		label: "New Line",
		companyId: 12,
		img: "New%20Line%20Cinema.png",
	},
	{
		blockIdSuffix: "studio-orion",
		title: "Orion Pictures",
		label: "Orion",
		companyId: 267168,
		img: "Orion%20Pictures.png",
	},
	{
		blockIdSuffix: "studio-paramount",
		title: "Paramount Pictures",
		label: "Paramount",
		companyId: 4,
		img: "Paramount%20Pictures.png",
	},
	{
		blockIdSuffix: "studio-pixar",
		title: "Pixar Animation Studios",
		label: "Pixar",
		companyId: 3,
		img: "Pixar%20Animation%20Studios.png",
	},
	{
		blockIdSuffix: "studio-sony",
		title: "Sony Pictures",
		label: "Sony",
		companyId: 11073,
		img: "Sony%20Pictures.png",
	},
	{
		blockIdSuffix: "studio-universal",
		title: "Universal Pictures",
		label: "Universal",
		companyId: 33,
		img: "Universal%20Pictures.png",
	},
	{
		blockIdSuffix: "studio-disney",
		title: "Walt Disney Pictures",
		label: "Disney",
		companyId: 2,
		img: "Walt%20Disney%20Pictures.png",
	},
	{
		blockIdSuffix: "studio-warner",
		title: "Warner Bros. Pictures",
		label: "Warner",
		companyId: 174,
		img: "Warner%20Bros.%20Pictures.png",
	},
];

export function studioBlockId(prefix: "community-ar" | "community-zh", suffix: string) {
	return `${prefix}-${suffix}`;
}
