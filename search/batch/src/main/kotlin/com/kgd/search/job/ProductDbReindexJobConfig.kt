package com.kgd.search.job

import com.kgd.search.domain.product.model.ProductDocument
import com.kgd.search.infrastructure.config.ProductDataSourceConfig
import com.kgd.search.infrastructure.indexing.EsBulkDocumentProcessor
import com.kgd.search.infrastructure.indexing.IndexAliasManager
import org.springframework.batch.core.job.Job
import org.springframework.batch.core.step.Step
import org.springframework.batch.core.job.builder.JobBuilder
import org.springframework.batch.core.repository.JobRepository
import org.springframework.batch.core.step.builder.StepBuilder
import org.springframework.batch.infrastructure.item.ItemProcessor
import org.springframework.batch.infrastructure.item.database.Order
import org.springframework.batch.infrastructure.item.database.builder.JdbcPagingItemReaderBuilder
import org.springframework.batch.infrastructure.item.database.support.SqlPagingQueryProviderFactoryBean
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.transaction.PlatformTransactionManager
import javax.sql.DataSource

@Configuration
@ConditionalOnProperty(name = ["reindex.source"], havingValue = "db")
class ProductDbReindexJobConfig(
    private val jobRepository: JobRepository,
    private val transactionManager: PlatformTransactionManager,
    @Qualifier("productDataSource") private val productDataSource: DataSource,
    private val aliasManager: IndexAliasManager,
    private val bulkProcessor: EsBulkDocumentProcessor,
    @Value("\${search.batch.index-alias:products}") private val indexAlias: String,
    @Value("\${search.batch.page-size:100}") private val pageSize: Int
) {

    @Bean
    fun productDbReindexJob(dbReindexStep: Step): Job =
        JobBuilder("productDbReindexJob", jobRepository)
            .listener(reindexJobExecutionListener())
            .start(dbReindexStep)
            .build()

    @Bean
    fun dbReindexStep(): Step =
        StepBuilder("dbReindexStep", jobRepository)
            .chunk<ProductRow, ProductDocument>(pageSize, transactionManager)
            .reader(productJdbcReader())
            .processor(productDocumentProcessor())
            .writer(productEsItemWriter())
            .build()

    @Bean
    fun productJdbcReader() = run {
        val provider = SqlPagingQueryProviderFactoryBean().apply {
            setDataSource(productDataSource)
            setSelectClause("SELECT id, name, price, stock, status, created_at")
            setFromClause("FROM products")
            setSortKeys(mapOf("id" to Order.ASCENDING))
        }
        JdbcPagingItemReaderBuilder<ProductRow>()
            .name("productJdbcReader")
            .dataSource(productDataSource)
            .queryProvider(provider.`object`)
            .pageSize(pageSize)
            .rowMapper { rs, _ ->
                ProductRow(
                    id = rs.getLong("id"),
                    name = rs.getString("name"),
                    price = rs.getBigDecimal("price"),
                    stock = rs.getInt("stock"),
                    status = rs.getString("status"),
                    createdAt = rs.getTimestamp("created_at").toLocalDateTime()
                )
            }
            .build()
    }

    @Bean
    fun productDocumentProcessor(): ItemProcessor<ProductRow, ProductDocument> =
        ItemProcessor { row: ProductRow ->
            ProductDocument(
                id = row.id.toString(),
                name = row.name,
                price = row.price,
                status = row.status,
                createdAt = row.createdAt
            )
        }

    @Bean
    fun productEsItemWriter(): ProductEsItemWriter =
        ProductEsItemWriter(bulkProcessor)

    @Bean
    fun reindexJobExecutionListener(): ReindexJobExecutionListener =
        ReindexJobExecutionListener(aliasManager, bulkProcessor, indexAlias)
}
