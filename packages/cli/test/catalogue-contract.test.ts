import { catalogueListContract, catalogueRecordContract } from '../../catalog/test/contract.ts'
import { catalogueOf } from '../src/operations.ts'

catalogueListContract('the CLI', catalogueOf)
catalogueRecordContract('the CLI', catalogueOf)
