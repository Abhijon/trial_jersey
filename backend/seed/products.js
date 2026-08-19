// S3 Product Catalog configuration using environment variables
const s3BaseUrl =`https://${process.env.AWS_S3_BUCKET_NAME || "trail-jerseys-bucket"}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/products`;


module.exports = [
  {
    name: "trailUnited Home Jersey",
    club: "trailUnited",
    kitType: "home",
    season: "2026/27",
    price: 2999,
    currency: "INR",
    description:
      "The home shirt, cut from lightweight breathable weave with a ribbed collar. Worn under the lights, made for the terraces.",
    image: `${s3BaseUrl}/trail-home-01.svg`,
    featured: true,
  },
  {
    name: "trailUnited Away Jersey",
    club: "trailUnited",
    kitType: "away",
    season: "2026/27",
    price: 2999,
    currency: "INR",
    description:
      "Clean, off-pitch colourway with tonal detailing. Same match-grade fabric, built for wherever the fixture takes you.",
    image: `${s3BaseUrl}/trail-away-07.svg`,
    featured: true,
  },
  {
    name: "Real Madrid 2012/13 Away Jersey",
    club: "Real Madrid",
    kitType: "away",
    season: "2012/13",
    price: 3499,
    currency: "INR",
    description:
      "The iconic Real Madrid away shirt in deep green, featuring the classic adidas three-stripe detailing, club crest, and Bwin sponsor. A lightweight retro jersey inspired by the 2012/13 season.",
    image: `${s3BaseUrl}/rm away.jpeg`,
    featured: true,
  },
  {
    name: "trailUnited Heritage Retro Shirt",
    club: "trailUnited",
    kitType: "retro",
    season: "1998 Reissue",
    price: 2499,
    currency: "INR",
    description:
      "A reissue of the shirt that started it all. Heavier cotton-feel fabric, the badge you remember, none of the gimmicks.",
    image: `${s3BaseUrl}/trail-retro-08.svg`,
    featured: true,
  },
  {
    name: "trailUnited Goalkeeper Jersey",
    club: "trailUnited",
    kitType: "goalkeeper",
    season: "2026/27",
    price: 2799,
    currency: "INR",
    description:
      "Padded elbow panels and a grippier cuff. Built for the last line of defence, not just the look.",
    image: `${s3BaseUrl}/trail-gk-01.svg`,
    featured: false,
  },
  {
    name: "trailUnited Home Jersey - Long Sleeve",
    club: "trailUnited",
    kitType: "home",
    season: "2026/27",
    price: 3199,
    currency: "INR",
    description:
      "The home shirt in long sleeve. Same crest, same fit through the shoulders, built for cold-weather fixtures.",
    image: `${s3BaseUrl}/trail-home-10.svg`,
    featured: false,
  },
  {
    name: "trailUnited Away Jersey - Women's Fit",
    club: "trailUnited",
    kitType: "away",
    season: "2026/27",
    price: 2999,
    currency: "INR",
    description:
      "The away shirt, tailored fit. Same fabric technology, cut to sit right without losing the shape of the kit.",
    image: `${s3BaseUrl}/trail-away-04.svg`,
    featured: false,
  },
  {
    name: "trailUnited Anthem Jacket",
    club: "trailUnited",
    kitType: "anthem",
    season: "2026/27",
    price: 3999,
    currency: "INR",
    description:
      "What the squad wears walking out. A full-zip anthem jacket for matchday mornings and the long walk to the ground.",
    image: `${s3BaseUrl}/trail-anthem-23.svg`,
    featured: true,
  },
];
