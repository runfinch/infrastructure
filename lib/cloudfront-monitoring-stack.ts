import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

const DEFAULT_METRIC_PERIOD: cdk.Duration = cdk.Duration.minutes(5);

interface CloudfrontMonitoringStackProps {
    distributionId: string;
}

export class CloudfrontMonitoringStack extends Construct {
    private metrics: Record<string, cloudwatch.Metric> = {};

    constructor(scope: Construct, id: string, props: CloudfrontMonitoringStackProps) {
        super(scope, id);

        this.createMetrics(props);

        this.createAlarms(props);

        this.createDashboard(props, id);
    }

    createMetrics(props: CloudfrontMonitoringStackProps) {
        const distributionId = props.distributionId;

        // Request metrics
        this.metrics.requests = new cloudwatch.Metric({
            namespace: 'AWS/CloudFront',
            metricName: 'Requests',
            dimensionsMap: { DistributionId: distributionId },
            statistic: 'Sum',
            period: DEFAULT_METRIC_PERIOD
        });

        // Data transfer metrics
        this.metrics.bytesDownloaded = new cloudwatch.Metric({
            namespace: 'AWS/CloudFront',
            metricName: 'BytesDownloaded',
            dimensionsMap: { DistributionId: distributionId },
            statistic: 'Sum',
            period: DEFAULT_METRIC_PERIOD
        });

        this.metrics.bytesUploaded = new cloudwatch.Metric({
            namespace: 'AWS/CloudFront',
            metricName: 'BytesUploaded',
            dimensionsMap: { DistributionId: distributionId },
            statistic: 'Sum',
            period: DEFAULT_METRIC_PERIOD
        });

        // Error rate metrics
        this.metrics.errorRate4xx = new cloudwatch.Metric({
            namespace: 'AWS/CloudFront',
            metricName: '4xxErrorRate',
            dimensionsMap: { DistributionId: distributionId },
            statistic: 'Average',
            period: DEFAULT_METRIC_PERIOD
        });

        this.metrics.errorRate5xx = new cloudwatch.Metric({
            namespace: 'AWS/CloudFront',
            metricName: '5xxErrorRate',
            dimensionsMap: { DistributionId: distributionId },
            statistic: 'Average',
            period: DEFAULT_METRIC_PERIOD
        });

        this.metrics.totalErrorRate = new cloudwatch.Metric({
            namespace: 'AWS/CloudFront',
            metricName: 'TotalErrorRate',
            dimensionsMap: { DistributionId: distributionId },
            statistic: 'Average',
            period: DEFAULT_METRIC_PERIOD
        });

        // Performance metrics
        this.metrics.originLatency = new cloudwatch.Metric({
            namespace: 'AWS/CloudFront',
            metricName: 'OriginLatency',
            dimensionsMap: { DistributionId: distributionId },
            statistic: 'Average',
            period: DEFAULT_METRIC_PERIOD
        });

        // Cache metrics
        this.metrics.cacheHitRate = new cloudwatch.Metric({
            namespace: 'AWS/CloudFront',
            metricName: 'CacheHitRate',
            dimensionsMap: { DistributionId: distributionId },
            statistic: 'Average',
            period: DEFAULT_METRIC_PERIOD
        });
    }

    createAlarms(props: CloudfrontMonitoringStackProps) {
        // High Error Rate Alarm
        new cloudwatch.Alarm(this, 'HighErrorRateAlarm', {
            alarmName: `CloudFront-${props.distributionId}-HighErrorRate`,
            alarmDescription: 'CloudFront distribution has high error rate',
            metric: this.metrics.totalErrorRate,
            threshold: 5, // 5% error rate
            evaluationPeriods: 2,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD
        });

        // High Origin Latency Alarm
        new cloudwatch.Alarm(this, 'HighOriginLatencyAlarm', {
            alarmName: `CloudFront-${props.distributionId}-HighLatency`,
            alarmDescription: 'CloudFront distribution has high origin latency',
            metric: this.metrics.originLatency,
            threshold: 3000, // 3 seconds
            evaluationPeriods: 3,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD
        });
    }

    createDashboard(props: CloudfrontMonitoringStackProps, id: string) {
        new cloudwatch.Dashboard(this, 'CloudFrontDashboard', {
            dashboardName: `CloudFront-${props.distributionId}-Dashboard`,
            widgets: [
                [
                    // Request metrics
                    new cloudwatch.GraphWidget({
                        title: 'Requests',
                        left: [this.metrics.requests],
                        width: 12,
                        height: 6
                    }),
                    // Cache hit rate
                    new cloudwatch.GraphWidget({
                        title: 'Cache Hit Rate (%)',
                        left: [this.metrics.cacheHitRate],
                        width: 12,
                        height: 6
                    })
                ],
                [
                    // Error rates
                    new cloudwatch.GraphWidget({
                        title: 'Error Rates (%)',
                        left: [
                            this.metrics.errorRate4xx,
                            this.metrics.errorRate5xx,
                            this.metrics.totalErrorRate
                        ],
                        width: 12,
                        height: 6
                    }),
                    // Origin latency
                    new cloudwatch.GraphWidget({
                        title: 'Origin Latency (ms)',
                        left: [this.metrics.originLatency],
                        width: 12,
                        height: 6
                    })
                ],
                [
                    // Data transfer
                    new cloudwatch.GraphWidget({
                        title: 'Data Transfer (Bytes)',
                        left: [this.metrics.bytesDownloaded],
                        right: [this.metrics.bytesUploaded],
                        width: 24,
                        height: 6
                    })
                ]
            ]
        });
    }
}