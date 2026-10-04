export class OgameQueryResult {
    public AccountInfoFetched: boolean = false;
    public LastAccountInfoFetchDateISO: string | undefined;
    public AccountInfo: any;

    public LifeformBonusesFetched: boolean = false;
    public LastLifeformBonusesFetchDateISO: string | undefined;
    public LifeformBonuses: any;

    public TechQuantitiesFetched: boolean = false;
    public LastTechQuantitiesFetchDateISO: string | undefined;
    public TechQuantities: any;

    public ImportExportFetched: boolean = false;
    public LastImportExportFetchDateISO: string | undefined;
    public ImportExport: any;
}