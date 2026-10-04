import { OgameDomData } from "../../dom/ogameDom/ogameDomData";

export class ExtensionSessionData {
    public UniverseKey: string;

    public AccountInfo: any;
    public LastAccountInfoFetchDateISO: string | undefined;

    public LifeformBonuses: any;
    public LastLifeformBonusesFetchDateISO: string | undefined;

    public TechQuantities: any;
    public LastTechQuantitiesFetchDateISO: string | undefined;

    public ImportExport: any;
    public LastImportExportFetchDateISO: string | undefined;

    public PageData: OgameDomData | undefined;

    constructor(data: Partial<ExtensionSessionData>) {
        if (!data.UniverseKey) {
            throw new Error("UniverseKey is required");
        }

        this.UniverseKey = data.UniverseKey;

        this.AccountInfo = data.AccountInfo;
        this.LastAccountInfoFetchDateISO = data.LastAccountInfoFetchDateISO;

        this.LifeformBonuses = data.LifeformBonuses;
        this.LastLifeformBonusesFetchDateISO = data.LastLifeformBonusesFetchDateISO;

        this.TechQuantities = data.TechQuantities;
        this.LastTechQuantitiesFetchDateISO = data.LastTechQuantitiesFetchDateISO;

        this.ImportExport = data.ImportExport;
        this.LastImportExportFetchDateISO = data.LastImportExportFetchDateISO;

        this.PageData = data.PageData;
    }
}