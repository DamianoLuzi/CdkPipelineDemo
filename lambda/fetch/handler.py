import json
import os
import boto3
from botocore.exceptions import ClientError
from decimal import Decimal

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return json.JSONEncoder.default(self, obj)

dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get('TABLE_NAME')
table = dynamodb.Table(table_name)


def lambda_handler(event, context):
    """
    Performs a 'Scan' operation, which reads every item in the table.
    For production applications with a large number of posts, a 'Query' operation
    (which is more efficient) with an index on the 'createdAt' key would be a
    better 
    """
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",  # CORS header
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    }
    
    try:
        response = table.scan()
        items = response.get('Items', [])
        items.sort(key=lambda x: x['createdAt'], reverse=True)

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(items, cls=DecimalEncoder)
        }
    except ClientError as e:
        print(f"Error fetching posts: {e.response['Error']['Message']}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Failed to fetch posts', 'message': e.response['Error']['Message']})
        }
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'An unexpected error occurred', 'message': str(e)})
        }
