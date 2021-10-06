---
title: "C# 9.0 : Record 타입"
date: 2021-10-06T22:00:56.653Z
category: Programming
tags:
  - C#
---
.NET 5 이상에서 사용 가능한 C# 9.0 버전에 추가된 내용 중 가장 낯선 내용은 레코드라는 것이 추가되었다는 거였습니다.
이번엔 레코드에 관해 조사한 내용을 정리 및 공유하려고 합니다.
<!--more-->
:br

## 개요
기존 C#에서는 struct로 대표되는 Value 타입과 class로 대표되는 Reference 타입으로 분류가 가능했습니다.
새로 추가된 레코드의 경우 class와 같은 Reference 타입입니다.
하지만, 두 레코드 변수에 대한 비교를 진행할 때 레코드 정의와 모든 필드의 값이 같은지 비교하는 '값 기반 같음'을 사용한다는 점에서 class와 구분됩니다.

반대로 struct와 비교를 하게 되면, struct로도 충분히 값 기반 같음을 제공하고, 아래에서 설명할 불변 데이터 중심의 디자인이 가능합니다.
하지만 struct는 상속을 지원하지 않고, 값 기반 같음을 구현했을 때 레코드에 비해 효율이 낮다고 합니다.
값 형식의 ValueType.Equals 메소드는 리플렉션을 통해 모든 필드를 찾지만, 레코드는 컴파일러가 Equals 메소드를 생성합니다.
:br

## 레코드 정의하기
레코드를 정의하기 위해선 record라는 키워드를 사용합니다.
기존의 struct나 class를 정의하듯이 정의한다면 다음과 같이 사용할 수 있습니다.
```csharp
public record Test
{
    public int ID { get; init; } = default;
    public string Value { get; init; } = default;
};
```
처음 보는 키워드가 또 있네요.
init은 프로퍼티의 set 대신 사용할 수 있는 키워드로, 초기화 이후에는 변경이 불가능한 프로퍼티를 만들 수 있습니다. 이를 초기화 전용 프로퍼티라고 합니다.
레코드의 경우 기존처럼 (set을 사용하는) 변경 가능한 값을 가지는 데이터로 사용할 수도 있지만, 주로 (init을 사용하는) 변경 불가능한 값을 가지는 데이터를 지원하기 위한 목적이라고 합니다.[^1]

[^1]: 출처: [마이크로소프트 공식 C# 가이드](https://docs.microsoft.com/ko-kr/dotnet/csharp/language-reference/builtin-types/record)

### 더 간단하게 정의하기
레코드가 변경 불가능한, 불변 데이터를 다루는 것에 주로 목적을 두고 있다고 했습니다.
이를 증명하는 것처럼 레코드의 경우 초기화 전용 프로퍼티를 가지는 레코드를 더욱 간단하게 정의할 수 있습니다.
```csharp
public record Test(int ID, string Value);
```
위 코드에서 int ID나 string Value를 위치 매개 변수라고 부릅니다.
이렇게 정의했을 때, 컴파일러는 각 위치 매개 변수에 대해 초기화 전용 프로퍼티를 생성하고, 위 선언에 맞게 기본 생성자를 제공합니다.
또한 둘 이상의 위치 매개 변수가 있다면 Deconstruct 메소드를 제공해 정의된 레코드를 분해할 수 있게 됩니다.
:br

## 값 기반 같음
런타임 형식이 일치하고, 모든 프로퍼티와 필드 값이 일치할 경우 레코드 형식의 두 변수가 같다고 판단하는 방식입니다.
기존의 Reference 타입은 두 변수가 같다고 판단하는 기준은 ID이므로, 두 변수가 같은 개체를 참조해야 두 변수를 같다고 판단하는 점에서 레코드와 class의 차이가 있습니다.
```csharp
using static System.Console;

public class Program
{
	public record Test1(int ID, string Value);
	public class Test2
	{
		public int ID { get; set; }
		public string Value { get; set; }
		
		public Test2(int ID, string Value)
		{
			this.ID = ID;
			this.Value = Value;
		}
	}

	public static void Main()
	{
		// record : 값 기반 비교
		Test1 test1_1 = new(1, "aaa");
		Test1 test1_2 = new(1, "aaa");
		WriteLine(test1_1.Equals(test1_2)); 			// output: True
		WriteLine(ReferenceEquals(test1_1, test1_2)); 	// output: False
		
		// class : 참조하는 개체 동일 여부 비교
		Test2 test2_1 = new(1, "aaa");
		Test2 test2_2 = new(1, "aaa");
		WriteLine(test2_1.Equals(test2_2)); 			// output: False
		WriteLine(ReferenceEquals(test2_1, test2_2)); 	// output: False
	}
}
```
:br

## 아니 레코드가 복사가 된다고? 아니 레코드가 복사가 된다고?
레코드의 경우 불변 데이터를 변경해야하는 경우 등 기존의 레코드 변수를 복제해야하는 상황일 때 사용할 수 있는 키워드가 있습니다.
바로 with인데요, 아래의 코드처럼 사용할 수 있습니다.
```csharp
using static System.Console;

public class Program
{
	public record Test(int ID, string Value);

	public static void Main()
	{
		Test test1 = new(1, "aaa");
		WriteLine(test1);
		// output : Test { ID = 1, Value = aaa }
		
		Test test2 = test1 with
		{
			ID = 2
		};
		WriteLine(test2);
		// output : Test { ID = 2, Value = aaa }
		
		Test test3 = test1 with
		{
			Value = "bbb"
		};
		WriteLine(test3);
		// output : Test { ID = 1, Value = bbb }
		
		Test test4 = test1 with { };
		WriteLine(test4);
		// output : Test { ID = 1, Value = aaa }
		
		// test4는 test1을 복제해 같은 값을 갖지만 다른 개체입니다
		WriteLine(test1 == test4);					// output : True
		WriteLine(ReferenceEquals(test1, test4));	// output : False
	}
}
```
:br

## 상속
레코드는 다른 레코드를 상속할 수 있습니다.
하지만, 레코드는 클래스를 상속받을 수 없고, 클래스도 레코드를 상속받을 수 없습니다.
```csharp
using static System.Console;

public class Program
{
	public record Base(int ID, string Value);
	public record Test1(int ID, string Value, bool Other) : Base(ID, Value);
	public record Test2(int ID, string Value, bool Other) : Base(ID, Value);

	public static void Main()
	{
		Test1 test1 = new(1, "aaa", true);
		Test2 test2 = new(1, "aaa", true);
		WriteLine(test1 == test2); // output : False
	}
}
```
위 코드에서 test1과 test2는 동일한 프로퍼티와 값을 갖지만, 런타임 형식이 다르기 때문에 두 값을 비교했을 때 다르다는 결과를 받게 됩니다.
:br

## 제네릭 제약 조건
제네릭 선언 시에 형식을 레코드로 제약하는 별도의 조건은 없지만, 레코드는 class 제약 조건을 만족하기 때문에 class를 사용하시면 됩니다.
```csharp
using static System.Console;

public class Program
{
	public record Test(int ID, string Value);
	
	public static void Print<T>(T val) where T : class
	{
		WriteLine(val);
	}

	public static void Main()
	{
		Test test = new(1, "aaa");
		Print(test);
		// output : Test { ID = 1, Value = aaa }
	}
}
```
:br

## 참조
* 위에 등장하는 코드들은 .NET Fiddle을 통해 테스트를 마쳤습니다.
* 위 내용의 대부분은 [마이크로소프트 공식 C# 가이드](https://docs.microsoft.com/ko-kr/dotnet/csharp/)를 참고했습니다.