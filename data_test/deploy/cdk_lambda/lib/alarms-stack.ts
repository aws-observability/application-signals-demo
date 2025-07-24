import { Stack, StackProps, Duration, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as fs from 'fs';
import * as path from 'path';

export interface AlarmsStackProps extends StackProps {
  logsTestCasesPath: string;
  metricsTestCasesPath: string;
  tracesTestCasesPath: string;
}

export class AlarmsStack extends Stack {
  // Store all created alarms
  private individualAlarms: { [key: string]: cloudwatch.Alarm } = {};
  private scenarioAlarms: { [key: string]: { alarmName: string, childAlarms: cloudwatch.Alarm[] } } = {};
  private scenarioCompAlarms: cloudwatch.CompositeAlarm[] = [];
  private rootAlarm: cloudwatch.CompositeAlarm;

  constructor(scope: Construct, id: string, props: AlarmsStackProps) {
    super(scope, id, props);

    // Load test case files
    const logsTestCases = this.loadTestCases(props.logsTestCasesPath, 'logs');
    const metricsTestCases = this.loadTestCases(props.metricsTestCasesPath, 'metrics');
    const tracesTestCases = this.loadTestCases(props.tracesTestCasesPath, 'traces');

    // Create individual alarms for each test case
    this.createLogsAlarms(logsTestCases);
    this.createMetricsAlarms(metricsTestCases);
    this.createTracesAlarms(tracesTestCases);

    // Create composite alarms by scenario
    this.createScenarioAlarms();

    // Create the root alarm
    this.createRootAlarm();
  }

  private loadTestCases(filePath: string, testType: string): any[] {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      if (testType === 'logs') {
        return data.log_test_cases || [];
      } else if (testType === 'metrics') {
        return data.metric_test_cases || [];
      } else if (testType === 'traces') {
        return data.trace_test_cases || [];
      }
      
      return [];
    } catch (error) {
      console.warn(`Failed to load ${testType} test cases from ${filePath}: ${error}`);
      return [];
    }
  }

  private sanitizeName(name: string): string {
    return name.trim().replace(/ /g, '_');
  }

  private createLogsAlarms(testCases: any[]): void {
    testCases.forEach(testCase => {
      const alarmName = `APMDemoTest.${this.sanitizeName(testCase.test_scenario)}.${this.sanitizeName(testCase.test_case_id)}`;
      const alarmDescription = `Alarm for monitoring ${testCase.description}`;

      const alarm = new cloudwatch.Alarm(this, alarmName, {
        alarmName,
        alarmDescription,
        metric: new cloudwatch.Metric({
          namespace: 'APMTestResults',
          metricName: 'TestResult',
          dimensionsMap: {
            TestType: 'logs',
            TestCaseId: testCase.test_case_id,
            TestScenario: testCase.test_scenario
          },
          statistic: 'Sum',
          period: Duration.minutes(30),
        }),
        evaluationPeriods: 8, // 8 data points within 4 hours
        threshold: 0.5, // Value is 0 when test fails, 1 when succeeds
        comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
        datapointsToAlarm: 8, // Alarm when all 8 data points trigger
        treatMissingData: cloudwatch.TreatMissingData.MISSING,
      });

      // Add tag to the alarm
      Tags.of(alarm).add('Project', 'APMDemo');

      // Store the alarm for later use in composite alarms
      this.individualAlarms[alarmName] = alarm;

      // Keep track of scenarios for composite alarms
      if (!this.scenarioAlarms[testCase.test_scenario]) {
        this.scenarioAlarms[testCase.test_scenario] = {
          alarmName: `APMDemoTest.${this.sanitizeName(testCase.test_scenario)}`,
          childAlarms: []
        };
      }
      
      this.scenarioAlarms[testCase.test_scenario].childAlarms.push(alarm);
    });
  }

  private createMetricsAlarms(testCases: any[]): void {
    testCases.forEach(testCase => {
      const alarmName = `APMDemoTest.${this.sanitizeName(testCase.test_scenario)}.${this.sanitizeName(testCase.test_case_id)}`;
      const alarmDescription = `Alarm for monitoring ${testCase.description}`;

      const alarm = new cloudwatch.Alarm(this, alarmName, {
        alarmName,
        alarmDescription,
        metric: new cloudwatch.Metric({
          namespace: 'APMTestResults',
          metricName: 'TestResult',
          dimensionsMap: {
            TestType: 'metrics',
            TestCaseId: testCase.test_case_id,
            TestScenario: testCase.test_scenario
          },
          statistic: 'Sum',
          period: Duration.minutes(30),
        }),
        evaluationPeriods: 8,
        threshold: 0.5,
        comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
        datapointsToAlarm: 8,
        treatMissingData: cloudwatch.TreatMissingData.MISSING,
      });

      // Add tag to the alarm
      Tags.of(alarm).add('Project', 'APMDemo');

      // Store the alarm for later use in composite alarms
      this.individualAlarms[alarmName] = alarm;

      // Keep track of scenarios for composite alarms
      if (!this.scenarioAlarms[testCase.test_scenario]) {
        this.scenarioAlarms[testCase.test_scenario] = {
          alarmName: `APMDemoTest.${this.sanitizeName(testCase.test_scenario)}`,
          childAlarms: []
        };
      }
      
      this.scenarioAlarms[testCase.test_scenario].childAlarms.push(alarm);
    });
  }

  private createTracesAlarms(testCases: any[]): void {
    testCases.forEach(testCase => {
      const alarmName = `APMDemoTest.${this.sanitizeName(testCase.test_scenario)}.${this.sanitizeName(testCase.test_case_id)}`;
      const alarmDescription = `Alarm for monitoring ${testCase.description}`;

      const alarm = new cloudwatch.Alarm(this, alarmName, {
        alarmName,
        alarmDescription,
        metric: new cloudwatch.Metric({
          namespace: 'APMTestResults',
          metricName: 'TestResult',
          dimensionsMap: {
            TestType: 'traces',
            TestCaseId: testCase.test_case_id,
            TestScenario: testCase.test_scenario
          },
          statistic: 'Sum',
          period: Duration.minutes(30),
        }),
        evaluationPeriods: 8,
        threshold: 0.5,
        comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
        datapointsToAlarm: 8,
        treatMissingData: cloudwatch.TreatMissingData.MISSING,
      });

      // Add tag to the alarm
      Tags.of(alarm).add('Project', 'APMDemo');

      // Store the alarm for later use in composite alarms
      this.individualAlarms[alarmName] = alarm;

      // Keep track of scenarios for composite alarms
      if (!this.scenarioAlarms[testCase.test_scenario]) {
        this.scenarioAlarms[testCase.test_scenario] = {
          alarmName: `APMDemoTest.${this.sanitizeName(testCase.test_scenario)}`,
          childAlarms: []
        };
      }
      
      this.scenarioAlarms[testCase.test_scenario].childAlarms.push(alarm);
    });
  }

  private createScenarioAlarms(): void {
    const createdScenarioAlarms: cloudwatch.CompositeAlarm[] = [];

    // Create a composite alarm for each scenario
    Object.entries(this.scenarioAlarms).forEach(([scenario, scenarioData]) => {
      const alarmName = `APMDemoTest.${this.sanitizeName(scenario)}`;
      const alarmDescription = `Composite alarm for monitoring all test cases in ${scenario}`;
      
      // Build alarm rule - OR condition for all child alarms
      const childAlarmRules = scenarioData.childAlarms.map(alarm => 
        cloudwatch.AlarmRule.fromAlarm(alarm, cloudwatch.AlarmState.ALARM)
      );
      
      const alarmRule = childAlarmRules.length > 1
        ? cloudwatch.AlarmRule.anyOf(...childAlarmRules)
        : childAlarmRules[0];

      const compositeAlarm = new cloudwatch.CompositeAlarm(this, alarmName, {
        compositeAlarmName: alarmName,
        alarmDescription,
        alarmRule,
      });

      // Add tags
      Tags.of(compositeAlarm).add('Project', 'APMDemo');
      Tags.of(compositeAlarm).add('AlarmType', 'ScenarioComposite');

      createdScenarioAlarms.push(compositeAlarm);
    });

    // Save created scenario alarms for root alarm
    this.scenarioCompAlarms = createdScenarioAlarms;
  }

  private createRootAlarm(): void {
    // Check if we have scenario alarms
    if (this.scenarioCompAlarms.length === 0) {
      return;
    }

    const alarmName = 'APMDemoTest.Root';
    const alarmDescription = 'Root composite alarm for monitoring all test scenarios';

    // Build alarm rule - OR condition for all scenario alarms
    const scenarioAlarmRules = this.scenarioCompAlarms.map(alarm => 
      cloudwatch.AlarmRule.fromAlarm(alarm, cloudwatch.AlarmState.ALARM)
    );
    
    const alarmRule = scenarioAlarmRules.length > 1
      ? cloudwatch.AlarmRule.anyOf(...scenarioAlarmRules)
      : scenarioAlarmRules[0];

    this.rootAlarm = new cloudwatch.CompositeAlarm(this, alarmName, {
      compositeAlarmName: alarmName,
      alarmDescription,
      alarmRule,
    });

    // Add tags
    Tags.of(this.rootAlarm).add('Project', 'APMDemo');
    Tags.of(this.rootAlarm).add('AlarmType', 'RootComposite');
  }
}